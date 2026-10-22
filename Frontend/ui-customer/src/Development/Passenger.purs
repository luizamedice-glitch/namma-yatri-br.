-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Development entry point: original HomeScreen view, without a server identity or authentication.
module Development.Passenger (start) where

import Prelude
import Components.PrimaryButton.Controller as PrimaryButton
import Components.SourceToDestination.Controller as SourceToDestination
import Components.SearchLocationModel.Controller as Search
import Components.SettingSideBar.Controller as Sidebar
import Control.Monad.Except.Trans (lift)
import Data.Maybe (Maybe(..))
import Data.Number (fromString)
import Effect.Unsafe (unsafePerformEffect)
import Engineering.Helpers.BackTrack (liftFlowBT)
import Engineering.Helpers.Commons (getVersionByKey)
import Engineering.Helpers.Utils (showToast)
import Helpers.PrestoUtils (initUIWrapper)
import JBridge as JB
import PrestoDOM (Eval, Screen, continue, continueWithCmd, exit)
import PrestoDOM.Core.Types.Language.Flow (runScreen)
import Screens.HomeScreen.Controllers.Types (Action(..)) as Home
import Screens.HomeScreen.Controller (getPeekHeight)
import Screens.HomeScreen.ScreenData as HomeData
import Screens.HomeScreen.View as HomeView
import Screens.Types (HomeScreenState, Stage(..), SearchLocationModelType(..))
import Storage (KeyStore(..), setValueToLocalStore, updateLocalStage)
import Types.App (FlowBT)

start :: Boolean -> FlowBT String Unit
start initialize = do
  when initialize $ initUIWrapper ""
  version <- liftFlowBT JB.getVersionName
  setValueToLocalStore VERSION_NAME version
  setValueToLocalStore BUNDLE_VERSION $ getVersionByKey "app"
  setValueToLocalStore COUNTRY_CODE "+55"
  setValueToLocalStore MapViewLottie "false"
  -- These are local display preferences, never a customer ID or access token.
  setValueToLocalStore USER_NAME "Fagner"
  void $ pure $ updateLocalStage HomeScreen
  liftFlowBT JB.initiateLocationServiceClient
  liftFlowBT $ JB.hideLoader ""
  loop $ HomeData.initData
    { props { showShimmer = false, isOffline = false, callbackInitiated = true }
    , data { config {sideBarList = []}, settingSideBar {name = "Fagner", sideBarList = [], appConfig {sideBarList = []}}, source = "Localização atual" }
    }

loop :: HomeScreenState -> FlowBT String Unit
loop state = do
  next <- lift $ lift $ runScreen $ screen state
  loop next

screen :: HomeScreenState -> Screen Home.Action HomeScreenState HomeScreenState
screen initialState =
  { initialState
  , view: HomeView.view
  , name: "HomeScreen"
  , globalEvents:
      [ \push -> do
          JB.requestLocation unit
          JB.getCurrentPosition push Home.UpdateCurrentLocation
          pure (pure unit)
      ]
  , eval
  }

eval :: Home.Action -> HomeScreenState -> Eval Home.Action HomeScreenState HomeScreenState
-- No profile, saved-address, offers, safety, scheduled-ride, analytics or push polling is started here.
eval (Home.UpdateCurrentLocation latitude longitude) state = position state latitude longitude
eval (Home.CurrentLocation latitude longitude) state = position state latitude longitude
eval (Home.MAPREADY _ _ _) state = do
  when (JB.isLocationPermissionEnabledWithoutEff unit) $ void $ pure $ JB.enableMyLocation true
  continue state

eval Home.RecenterCurrentLocation state = exit state

eval Home.UpdatePeekHeight state = continue state {data {peekHeight = getPeekHeight state}}

eval Home.WhereToClick state = do
  _ <- pure $ updateLocalStage SearchLocationModel
  continue state {props {currentStage = SearchLocationModel, isSource = Just false, isSearchLocation = SearchLocation}}

eval Home.OpenSearchLocation state = eval Home.WhereToClick state

eval Home.OpenSettings state = continue state {data {settingSideBar {opened = Sidebar.OPEN}}}
eval (Home.SettingSideBarActionController Sidebar.OnClose) state = continue state {data {settingSideBar {opened = Sidebar.CLOSED}}}
eval (Home.SettingSideBarActionController Sidebar.OnClosed) state = continue state {data {settingSideBar {opened = Sidebar.CLOSED}}}

eval Home.BackPressed state = do
  _ <- pure $ JB.hideKeyboardOnNavigation true
  if state.data.settingSideBar.opened /= Sidebar.CLOSED then
    continue state {data {settingSideBar {opened = Sidebar.CLOSED}}}
  else if state.props.currentStage /= HomeScreen then do
    _ <- pure $ updateLocalStage HomeScreen
    continue state {props {currentStage = HomeScreen}}
  else do
    _ <- pure $ JB.minimizeApp ""
    continue state

eval (Home.SearchLocationModelActionController Search.GoBack) state = eval Home.BackPressed state
eval (Home.SearchLocationModelActionController Search.GoBackSearchModel) state = eval Home.BackPressed state
eval (Home.SearchLocationModelActionController (Search.SourceChanged value)) state =
  continue state {data {source = value}, props {searchLocationModelProps {crossBtnSrcVisibility = value /= "", isAutoComplete = false}}}
eval (Home.SearchLocationModelActionController (Search.DestinationChanged value)) state =
  continue state {data {destination = value}, props {searchLocationModelProps {crossBtnDestVisibility = value /= "", isAutoComplete = false}}}
eval (Home.SearchLocationModelActionController (Search.EditTextFocusChanged field)) state =
  continue state {props {isSource = Just (field /= "D")}}
eval (Home.SearchLocationModelActionController Search.SourceClear) state =
  continue state {data {source = ""}, props {searchLocationModelProps {crossBtnSrcVisibility = false}}}
eval (Home.SearchLocationModelActionController Search.DestinationClear) state =
  continue state {data {destination = ""}, props {searchLocationModelProps {crossBtnDestVisibility = false}}}
eval (Home.SearchLocationModelActionController Search.SetCurrentLocation) state = exit state
eval (Home.SearchLocationModelActionController Search.RecenterCurrentLocation) state = exit state
eval (Home.SearchLocationModelActionController (Search.DebounceCallBack _ _)) state = do
  _ <- pure $ unsafePerformEffect $ showToast "Pesquisa de endereços ainda não conectada nesta versão."
  continue state
eval (Home.SearchLocationModelActionController Search.SetLocationOnMap) state = do
  _ <- pure $ unsafePerformEffect $ showToast "Seleção de endereço no mapa ainda não conectada nesta versão."
  continue state
eval (Home.ServicesOnClick _) state = unavailable state
eval (Home.SettingSideBarActionController _) state = unavailable state
eval (Home.SourceToDestinationActionController SourceToDestination.DestinationClicked) state = eval Home.WhereToClick state
eval (Home.PrimaryButtonActionController PrimaryButton.OnClick) state
  | state.props.currentStage == HomeScreen = eval Home.WhereToClick state
  | otherwise = unavailable state
eval (Home.PrimaryButtonActionController _) state = continue state
eval (Home.SearchLocationModelActionController (Search.PrimaryButtonActionController _)) state = unavailable state
-- Rendering callbacks and optional features cannot start network/authentication flows.
eval _ state = continue state

unavailable :: HomeScreenState -> Eval Home.Action HomeScreenState HomeScreenState
unavailable state = do
  _ <- pure $ unsafePerformEffect $ showToast "Corridas ainda não conectadas ao backend de desenvolvimento."
  continue state

position :: HomeScreenState -> String -> String -> Eval Home.Action HomeScreenState HomeScreenState
position state latitude longitude = case fromString latitude, fromString longitude of
  Just lat, Just lng | lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0 && (lat /= 0.0 || lng /= 0.0) -> do
    let label = latitude <> ", " <> longitude
    continueWithCmd state
      { props {sourceLat = lat, sourceLong = lng, currentLocation {lat = lat, lng = lng, place = label}}
      , data {source = label}
      }
      [ do
          JB.animateCamera lat lng 16.0 "ZOOM"
          pure Home.NoAction
      ]
  _, _ -> continue state
