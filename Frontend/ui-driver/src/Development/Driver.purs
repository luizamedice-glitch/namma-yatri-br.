-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Original driver dashboard, isolated from the legacy login and polling flows.
module Development.Driver where

import Prelude
import Effect (Effect)
import Effect.Aff (launchAff_)
import Effect.Class (liftEffect)
import Effect.Exception (message)
import Data.Either (Either(..))
import Control.Monad.Except.Trans (runExceptT, lift)
import Control.Transformers.Back.Trans (runBackT)
import Common.Types.App (Event, FCMBundleUpdate)
import Engineering.Helpers.Commons (flowRunner)
import Engineering.Helpers.BackTrack (liftFlowBT)
import Engineering.Helpers.Utils (showToast)
import PrestoDOM (initUI, Eval, Screen, continue)
import PrestoDOM.Core (processEvent)
import PrestoDOM.Core.Types.Language.Flow (runScreen)
import PrestoDOM.Types.Core (class Loggable)
import Screens.HomeScreen.View as Home
import Screens.HomeScreen.ScreenData as Data
import Screens.HomeScreen.Controller as Controller
import Screens.Types (HomeScreenState, AllocationData, DriverStatus(..))
import Types.App (FlowBT, defaultGlobalState)
import JBridge as JB
import Data.Number (fromString)
import Data.Maybe (Maybe(..))
import Effect.Unsafe (unsafePerformEffect)
import Development.PilotTrip as Trip
import Components.PrimaryButton as PB
import PrestoDOM as DOM

foreign import enabled :: Effect Boolean
foreign import prepareRuntime :: Effect Unit
foreign import checkpoint :: String -> Effect Unit
foreign import startupError :: String -> Effect Unit
foreign import availability :: Boolean -> (Boolean -> Effect Unit) -> (String -> Effect Unit) -> Effect Unit
foreign import location :: Number -> Number -> Effect Unit
foreign import subscribe :: (Boolean -> Effect Unit) -> (String -> Effect Unit) -> Effect Unit -> (Trip.Trip -> Effect Unit) -> Effect (Effect Unit)
foreign import act :: String -> String -> Effect Unit

type State = {home :: HomeScreenState,trip :: Trip.Trip}

data Action = Original Controller.Action | Availability Boolean | Failed String
  | NoOp | TripUpdated Trip.Trip | AcceptOffer PB.Action | RejectOffer PB.Action | CancelTrip PB.Action
instance showAction :: Show Action where
  show _ = ""
instance logAction :: Loggable Action where
  performLog _ _ = pure unit

main :: Event -> Effect Unit
main _ = do
  allowed <- enabled
  when allowed $ launchAff_ do
    liftEffect prepareRuntime
    liftEffect $ checkpoint "starting"
    result <- flowRunner defaultGlobalState $ runExceptT $ runBackT $ start
    case result of
      Left error -> liftEffect $ startupError $ message error
      Right (Left error) -> liftEffect $ startupError error
      _ -> pure unit

start :: FlowBT String Unit
start = do
  liftFlowBT $ checkpoint "initializing-ui"
  lift $ lift $ initUI
  liftFlowBT $ checkpoint "initializing-location"
  liftFlowBT JB.initiateLocationServiceClient
  liftFlowBT $ checkpoint "rendering-dashboard"
  loop {home:Data.initData {data {driverName = "Giselo"}, props {statusOnline = false, driverStatusSet = Offline}},trip:Trip.emptyTrip}

loop :: State -> FlowBT String Unit
loop state = do
  next <- lift $ lift $ runScreen $ screen state
  loop next

screen :: State -> Screen Action State State
screen state =
  {initialState: state, name: "HomeScreen", view: view
  ,globalEvents:
    [ \push -> subscribe (push <<< Availability) (push <<< Failed) (JB.getCurrentPosition push (\lat lng -> Original $ Controller.CurrentLocation lat lng)) (push <<< TripUpdated)
    , \push -> do
        JB.requestLocation unit
        JB.getCurrentPosition push (\lat lng -> Original $ Controller.CurrentLocation lat lng)
        pure (pure unit)
    ]
  ,eval}

view :: forall w. (Action -> Effect Unit) -> State -> DOM.PrestoDOM (Effect Unit) w
view push state = DOM.frameLayout [DOM.width DOM.MATCH_PARENT,DOM.height DOM.MATCH_PARENT]
  [Home.view (push <<< Original) state.home
  ,DOM.linearLayout [DOM.width DOM.MATCH_PARENT,DOM.height DOM.MATCH_PARENT,DOM.gravity DOM.CENTER,DOM.background "#88000000"
     ,DOM.visibility (if state.trip.phase=="offer" || state.trip.phase=="accepted" then DOM.VISIBLE else DOM.GONE)]
    [DOM.linearLayout [DOM.width DOM.MATCH_PARENT,DOM.height DOM.WRAP_CONTENT,DOM.orientation DOM.VERTICAL,DOM.margin (DOM.Margin 16 16 16 16),DOM.background "#FFFFFF"]
      [Trip.heading (if state.trip.phase=="offer" then "Nova solicitação" else "Viagem aceita")
      ,DOM.textView [DOM.text state.trip.passenger,DOM.textSize 18,DOM.padding (DOM.Padding 20 0 20 0),DOM.color "#242424"]
      ,Trip.card push NoOp state.trip
      ,DOM.linearLayout [DOM.width DOM.MATCH_PARENT,DOM.height DOM.WRAP_CONTENT,DOM.orientation DOM.VERTICAL,DOM.visibility (if state.trip.phase=="offer" then DOM.VISIBLE else DOM.GONE)]
        [Trip.button (push <<< AcceptOffer) "Aceitar viagem" true,Trip.button (push <<< RejectOffer) "Recusar" true]
      ,DOM.linearLayout [DOM.width DOM.MATCH_PARENT,DOM.height DOM.WRAP_CONTENT,DOM.visibility (if state.trip.phase=="accepted" then DOM.VISIBLE else DOM.GONE)]
        [Trip.button (push <<< CancelTrip) "Cancelar viagem" true]]]]

eval :: Action -> State -> Eval Action State State
eval (TripUpdated trip) state = continue state {trip=trip}
eval (AcceptOffer PB.OnClick) state = do
  _ <- pure $ unsafePerformEffect $ act "accept" state.trip.id
  continue state
eval (RejectOffer PB.OnClick) state = do
  _ <- pure $ unsafePerformEffect $ act "reject" state.trip.id
  continue state
eval (CancelTrip PB.OnClick) state = do
  _ <- pure $ unsafePerformEffect $ act "cancel" state.trip.id
  continue state
eval (Availability online) state = continue state {home {props {statusOnline = online, driverStatusSet = if online then Online else Offline}}}
eval (Failed message) state = do
  _ <- pure $ unsafePerformEffect $ showToast message
  continue state
eval (Original (Controller.SwitchDriverStatus Silent _)) state = do
  _ <- pure $ unsafePerformEffect $ showToast "O modo silencioso não está disponível nesta versão de testes."
  continue state
eval (Original (Controller.SwitchDriverStatus status _)) state = do
  _ <- pure $ unsafePerformEffect $ availability (status /= Offline) (const $ pure unit) (const $ pure unit)
  continue state
eval (Original (Controller.ChangeStatus online)) state = do
  _ <- pure $ unsafePerformEffect $ availability online (const $ pure unit) (const $ pure unit)
  continue state
eval (Original (Controller.GoOffline _)) state = do
  _ <- pure $ unsafePerformEffect $ availability false (const $ pure unit) (const $ pure unit)
  continue state
eval (Original (Controller.CurrentLocation latitude longitude)) state = case fromString latitude, fromString longitude of
  Just lat, Just lng | lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0 && (lat /= 0.0 || lng /= 0.0) -> do
    _ <- pure $ unsafePerformEffect $ location lat lng
    continue state {home {data {currentDriverLat = lat, currentDriverLon = lng}}}
  _, _ -> continue state
eval (Original Controller.AfterRender) state = do
  _ <- pure $ unsafePerformEffect $ checkpoint "dashboard-rendered"
  continue state {home {props {mapRendered = true}}}
eval (Original (Controller.ShowMap _ _ _)) state = continue state
eval (Original Controller.BackPressed) state = do
  _ <- pure $ JB.minimizeApp ""
  continue state
eval _ state = continue state

onEvent :: String -> Effect Unit
onEvent event = when (event == "onBackPressed") $ processEvent "onBackPressedEvent" unit
onConnectivityEvent :: String -> Effect Unit
onConnectivityEvent _ = pure unit
onNewIntent :: Event -> Effect Unit
onNewIntent _ = pure unit
onBundleUpdatedEvent :: FCMBundleUpdate -> Effect Unit
onBundleUpdatedEvent _ = pure unit
mainAllocationPop :: String -> AllocationData -> Effect Unit
mainAllocationPop _ _ = pure unit
onDestroy :: String -> Effect Unit
onDestroy _ = pure unit
