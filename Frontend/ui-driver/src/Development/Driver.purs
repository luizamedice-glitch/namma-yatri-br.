-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Original driver dashboard, isolated from the legacy login and polling flows.
module Development.Driver where

import Prelude
import Effect (Effect)
import Effect.Aff (launchAff_)
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

foreign import enabled :: Effect Boolean
foreign import availability :: Boolean -> (Boolean -> Effect Unit) -> (String -> Effect Unit) -> Effect Unit
foreign import location :: Number -> Number -> Effect Unit
foreign import subscribe :: (Boolean -> Effect Unit) -> (String -> Effect Unit) -> Effect Unit -> Effect (Effect Unit)

data Action = Original Controller.Action | Availability Boolean | Failed String
instance showAction :: Show Action where
  show _ = ""
instance logAction :: Loggable Action where
  performLog _ _ = pure unit

main :: Event -> Effect Unit
main _ = do
  allowed <- enabled
  when allowed $ launchAff_ $ void $ flowRunner defaultGlobalState $ runExceptT $ runBackT $ start

start :: FlowBT String Unit
start = do
  lift $ lift $ initUI
  liftFlowBT JB.initiateLocationServiceClient
  loop $ Data.initData {data {driverName = "Giselo"}, props {statusOnline = false, driverStatusSet = Offline}}

loop :: HomeScreenState -> FlowBT String Unit
loop state = do
  next <- lift $ lift $ runScreen $ screen state
  loop next

screen :: HomeScreenState -> Screen Action HomeScreenState HomeScreenState
screen state =
  {initialState: state, name: "HomeScreen", view: \push -> Home.view (push <<< Original)
  ,globalEvents:
    [ \push -> subscribe (push <<< Availability) (push <<< Failed) (JB.getCurrentPosition push (\lat lng -> Original $ Controller.CurrentLocation lat lng))
    , \push -> do
        JB.requestLocation unit
        JB.getCurrentPosition push (\lat lng -> Original $ Controller.CurrentLocation lat lng)
        pure (pure unit)
    ]
  ,eval}

eval :: Action -> HomeScreenState -> Eval Action HomeScreenState HomeScreenState
eval (Availability online) state = continue state {props {statusOnline = online, driverStatusSet = if online then Online else Offline}}
eval (Failed message) state = do
  _ <- pure $ unsafePerformEffect $ showToast message
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
    continue state {data {currentDriverLat = lat, currentDriverLon = lng}}
  _, _ -> continue state
eval (Original Controller.AfterRender) state = continue state {props {mapRendered = true}}
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
