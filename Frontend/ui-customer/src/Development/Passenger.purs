-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Development entry point: original HomeScreen view, without a server identity or authentication.
module Development.Passenger (start) where

import Prelude
import Components.PrimaryButton.Controller as PrimaryButton
import Components.SourceToDestination.Controller as SourceToDestination
import Components.SearchLocationModel.Controller as Search
import Components.SettingSideBar.Controller as Sidebar
import Control.Monad.Except.Trans (lift)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Array (null)
import Effect (Effect)
import Development.Places as Places
import Components.LocationListItem.Controller as LocationItem
import Data.Number (fromString)
import Data.String.CodeUnits as String
import Effect.Unsafe (unsafePerformEffect)
import Engineering.Helpers.BackTrack (liftFlowBT)
import Engineering.Helpers.Commons (getVersionByKey, getNewIDWithTag)
import Engineering.Helpers.Utils (showToast)
import Helpers.PrestoUtils (initUIWrapper)
import JBridge as JB
import PrestoDOM (Eval, Screen, continue, continueWithCmd, exit)
import PrestoDOM.Core.Types.Language.Flow (runScreen)
import Screens.HomeScreen.Controllers.Types (Action(..)) as Home
import Screens.HomeScreen.Controller (getPeekHeight)
import Screens.HomeScreen.ScreenData as HomeData
import Screens.HomeScreen.View as HomeView
import Screens.Types (HomeScreenState, Stage(..), SearchLocationModelType(..), LocationListItemState)
import Storage (KeyStore(..), setValueToLocalStore, updateLocalStage)
import Types.App (FlowBT)

data Action = Original Home.Action
  | SuggestionsLoaded Boolean (Array Places.Suggestion)
  | PlaceLoaded Boolean Places.Place
  | PlacesFailed String

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

screen :: HomeScreenState -> Screen Action HomeScreenState HomeScreenState
screen initialState =
  { initialState
  , view: \push -> HomeView.view (push <<< Original)
  , name: "HomeScreen"
  , globalEvents:
      [ \push -> do
          JB.requestLocation unit
          JB.getCurrentPosition push (\lat lng -> Original $ Home.UpdateCurrentLocation lat lng)
          pure (pure unit)
      , \push -> Places.subscribe (\field items -> push $ SuggestionsLoaded field items) (\field place -> push $ PlaceLoaded field place) (push <<< PlacesFailed)
      ]
  , eval
  }

eval :: Action -> HomeScreenState -> Eval Action HomeScreenState HomeScreenState
eval (Original action) state = evalHome action state
eval (SuggestionsLoaded field suggestions) state
  | state.props.currentStage /= SearchLocationModel || state.props.isSource /= Just field = continue state
  | otherwise = do
      when (null suggestions) $ void $ pure $ unsafePerformEffect $ showToast "Nenhum endereço encontrado. Tente incluir cidade ou número."
      continue state {data {locationList = map suggestionItem suggestions}, props {searchLocationModelProps {showLoader = false, isAutoComplete = true}}}
eval (PlacesFailed message) state = do
  _ <- pure $ unsafePerformEffect $ showToast message
  continue state {props {searchLocationModelProps {showLoader = false}}}
eval (PlaceLoaded field place) state = do
  _ <- pure $ JB.hideKeyboardOnNavigation true
  _ <- pure $ updateLocalStage HomeScreen
  let address = HomeData.dummyAddress {street = Just place.address, placeId = Just place.placeId}
      next = if field then state
        {data {source = place.address, sourceAddress = address, locationList = []}
        , props {sourceLat = place.lat, sourceLong = place.lng, sourcePlaceId = Just place.placeId}}
        else state
        {data {destination = place.address, destinationAddress = address, locationList = []}
        , props {destinationLat = place.lat, destinationLong = place.lng, destinationPlaceId = Just place.placeId}}
  continueWithCmd next {props {currentStage = HomeScreen, searchLocationModelProps {showLoader = false}}}
    [ do
        JB.animateCamera place.lat place.lng 16.0 "ZOOM"
        void $ JB.showMarker JB.defaultMarkerConfig
          {markerId = if field then "ny_ic_src_marker" else "ny_ic_dest_marker", pointerIcon = if field then "ny_ic_src_marker" else "ny_ic_dest_marker"}
          place.lat place.lng 110 0.5 0.9 (getNewIDWithTag "CustomerHomeScreen")
        pure (Original Home.NoAction)
    ]

suggestionItem :: Places.Suggestion -> LocationListItemState
suggestionItem item =
  { prefixImageUrl: "ny_ic_loc_unfilled", postfixImageUrl: "", postfixImageVisibility: false
  , lat: Nothing, lon: Nothing, placeId: Just item.placeId, subTitle: item.subTitle, title: item.title
  , description: item.address, tag: "", tagType: Nothing, cardType: Nothing, address: item.address
  , tagName: "", isEditEnabled: false, savedLocation: "", placeName: item.title, isClickable: true
  , alpha: 1.0, fullAddress: HomeData.dummyAddress, locationItemType: Nothing, distance: Nothing
  , showDistance: Just false, actualDistance: Nothing, frequencyCount: Nothing, recencyDate: Nothing
  , locationScore: Nothing, dynamicAction: Nothing, types: Nothing
  }

evalHome :: Home.Action -> HomeScreenState -> Eval Action HomeScreenState HomeScreenState
-- No profile, saved-address, offers, safety, scheduled-ride, analytics or push polling is started here.
evalHome (Home.UpdateCurrentLocation latitude longitude) state = position state latitude longitude
evalHome (Home.CurrentLocation latitude longitude) state = position state latitude longitude
evalHome (Home.MAPREADY _ _ _) state = do
  when (JB.isLocationPermissionEnabledWithoutEff unit) $ void $ pure $ JB.enableMyLocation true
  continue state

evalHome Home.RecenterCurrentLocation state = exit state {props {sourcePlaceId = Nothing}}

evalHome Home.UpdatePeekHeight state = continue state {data {peekHeight = getPeekHeight state}}

evalHome Home.WhereToClick state = do
  _ <- pure $ updateLocalStage SearchLocationModel
  continue state {props {currentStage = SearchLocationModel, isSource = Just false, isSearchLocation = SearchLocation}}

evalHome Home.OpenSearchLocation state = evalHome Home.WhereToClick state

evalHome Home.OpenSettings state = continue state {data {settingSideBar {opened = Sidebar.OPEN}}}
evalHome (Home.SettingSideBarActionController Sidebar.OnClose) state = continue state {data {settingSideBar {opened = Sidebar.CLOSED}}}
evalHome (Home.SettingSideBarActionController Sidebar.OnClosed) state = continue state {data {settingSideBar {opened = Sidebar.CLOSED}}}

evalHome Home.BackPressed state = do
  _ <- pure $ unsafePerformEffect Places.cancel
  _ <- pure $ JB.hideKeyboardOnNavigation true
  if state.data.settingSideBar.opened /= Sidebar.CLOSED then
    continue state {data {settingSideBar {opened = Sidebar.CLOSED}}}
  else if state.props.currentStage /= HomeScreen then do
    _ <- pure $ updateLocalStage HomeScreen
    continue state {props {currentStage = HomeScreen, searchLocationModelProps {showLoader = false}}}
  else do
    _ <- pure $ JB.minimizeApp ""
    continue state

evalHome (Home.SearchLocationModelActionController Search.GoBack) state = evalHome Home.BackPressed state
evalHome (Home.SearchLocationModelActionController Search.GoBackSearchModel) state = evalHome Home.BackPressed state
-- Match the original controller's input contract: editing belongs to the native EditText.
-- Rewriting data.source/destination on each key resets selection through afterRender/showKeyboard.
evalHome (Home.SearchLocationModelActionController (Search.SourceChanged value)) state =
  continueWithCmd state {data {locationList = []}, props {searchLocationModelProps {crossBtnSrcVisibility = String.length value > 2, isAutoComplete = false, showLoader = false}}}
    [ do
        Places.inputChanged value true
        _ <- pure $ JB.updateInputString value
        pure (Original Home.NoAction)
    ]
evalHome (Home.SearchLocationModelActionController (Search.DestinationChanged value)) state =
  continueWithCmd state {data {locationList = []}, props {searchLocationModelProps {crossBtnDestVisibility = String.length value > 2, isAutoComplete = false, showLoader = false}}}
    [ do
        Places.inputChanged value false
        _ <- pure $ JB.updateInputString value
        pure (Original Home.NoAction)
    ]
evalHome (Home.SearchLocationModelActionController (Search.EditTextFocusChanged field)) state
  | state.props.isSource == Just (field /= "D") = continue state
  | otherwise = do
      _ <- pure $ unsafePerformEffect Places.cancel
      continue state {data {locationList = []}, props {isSource = Just (field /= "D"), searchLocationModelProps {showLoader = false}}}
evalHome (Home.SearchLocationModelActionController Search.SourceClear) state = do
  _ <- pure $ unsafePerformEffect Places.cancel
  continue state {data {source = "", locationList = []}, props {sourcePlaceId = Nothing, searchLocationModelProps {crossBtnSrcVisibility = false, showLoader = false}}}
evalHome (Home.SearchLocationModelActionController Search.DestinationClear) state = do
  _ <- pure $ unsafePerformEffect Places.cancel
  continue state {data {destination = "", locationList = []}, props {destinationPlaceId = Nothing, destinationLat = 0.0, destinationLong = 0.0, searchLocationModelProps {crossBtnDestVisibility = false, showLoader = false}}}
evalHome (Home.SearchLocationModelActionController Search.SetCurrentLocation) state = exit state {props {sourcePlaceId = Nothing}}
evalHome (Home.SearchLocationModelActionController Search.RecenterCurrentLocation) state = exit state {props {sourcePlaceId = Nothing}}
evalHome (Home.SearchLocationModelActionController (Search.DebounceCallBack value field)) state
  | field /= fromMaybe false state.props.isSource = continue state
  | String.length value < 3 = continue state {data {locationList = []}, props {searchLocationModelProps {showLoader = false}}}
  | otherwise = continueWithCmd state {data {locationList = []}, props {searchLocationModelProps {showLoader = true}}}
      [ do
          Places.autocomplete value field state.props.currentLocation.lat state.props.currentLocation.lng
          pure (Original Home.NoAction)
      ]
evalHome (Home.SearchLocationModelActionController (Search.LocationListItemActionController (LocationItem.OnClick item))) state =
  case item.placeId of
    Nothing -> continue state
    Just placeId -> continueWithCmd state {props {searchLocationModelProps {showLoader = true}}}
      [ do
          Places.details placeId (fromMaybe false state.props.isSource)
          pure (Original Home.NoAction)
      ]
evalHome (Home.SearchLocationModelActionController Search.SetLocationOnMap) state = do
  _ <- pure $ unsafePerformEffect $ showToast "Seleção de endereço no mapa ainda não conectada nesta versão."
  continue state
evalHome (Home.ServicesOnClick _) state = unavailable state
evalHome (Home.SettingSideBarActionController _) state = unavailable state
evalHome (Home.SourceToDestinationActionController SourceToDestination.DestinationClicked) state = evalHome Home.WhereToClick state
evalHome (Home.PrimaryButtonActionController PrimaryButton.OnClick) state
  | state.props.currentStage == HomeScreen = evalHome Home.WhereToClick state
  | otherwise = unavailable state
evalHome (Home.PrimaryButtonActionController _) state = continue state
evalHome (Home.SearchLocationModelActionController (Search.PrimaryButtonActionController _)) state = unavailable state
-- Rendering callbacks and optional features cannot start network/authentication flows.
evalHome _ state = continue state

unavailable :: HomeScreenState -> Eval Action HomeScreenState HomeScreenState
unavailable state = do
  _ <- pure $ unsafePerformEffect $ showToast "Corridas ainda não conectadas ao backend de desenvolvimento."
  continue state

position :: HomeScreenState -> String -> String -> Eval Action HomeScreenState HomeScreenState
position state latitude longitude = case fromString latitude, fromString longitude of
  Just lat, Just lng | lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0 && (lat /= 0.0 || lng /= 0.0) -> do
    let label = latitude <> ", " <> longitude
    if state.props.sourcePlaceId /= Nothing then
      continue state {props {currentLocation {lat = lat, lng = lng, place = label}}}
    else continueWithCmd state
      { props {sourceLat = lat, sourceLong = lng, currentLocation {lat = lat, lng = lng, place = label}}
      , data {source = label}
      }
      [ do
          JB.animateCamera lat lng 16.0 "ZOOM"
          pure (Original Home.NoAction)
      ]
  _, _ -> continue state
