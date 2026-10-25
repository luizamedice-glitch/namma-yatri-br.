-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Development entry point: original HomeScreen view, without a server identity or authentication.
module Development.Passenger (start) where

import Prelude
import Components.PrimaryButton.Controller as PrimaryButton
import Components.SourceToDestination.Controller as SourceToDestination
import Components.SearchLocationModel.Controller as Search
import Components.SettingSideBar.Controller as Sidebar
import Components.GenericHeader.Controller as Header
import Control.Monad.Except.Trans (lift)
import Data.Maybe (Maybe(..), fromMaybe)
import Data.Array (null)
import Effect (Effect)
import Development.Places as Places
import Development.Geocoding as Geocoding
import Development.GeoAttribution as GeoAttribution
import Development.Rides as Rides
import Development.PilotTrip as Trip
import Development.Booking as Booking
import Components.LocationListItem.Controller as LocationItem
import Data.Number (fromString)
import Data.String.CodeUnits as String
import Effect.Unsafe (unsafePerformEffect)
import Engineering.Helpers.BackTrack (liftFlowBT)
import Engineering.Helpers.Commons (getVersionByKey, getNewIDWithTag)
import Engineering.Helpers.Utils (showToast)
import Helpers.PrestoUtils (initUIWrapper)
import JBridge as JB
import PrestoDOM (Eval, Screen, PrestoDOM, Length(..), Orientation(..), Gravity(..), Padding(..), Visibility(..), linearLayout, imageView, textView, height, width, weight, orientation, gravity, padding, background, color, text, textSize, imageWithFallback, onClick, onBackPressed, accessibilityHint, visibility, continue, continueWithCmd, exit)
import Screens.MyProfileScreen.View as ProfileView
import Screens.MyProfileScreen.ScreenData as ProfileData
import Screens.MyProfileScreen.Controller as Profile
import Helpers.Utils (FetchImageFrom(..), fetchImage)
import PrestoDOM.Core.Types.Language.Flow (runScreen)
import PrestoDOM.Types.Core (class Loggable)
import Screens.HomeScreen.Controllers.Types (Action(..)) as Home
import Screens.HomeScreen.Controller (getPeekHeight)
import Screens.HomeScreen.ScreenData as HomeData
import Screens.HomeScreen.View as HomeView
import Screens.Types (HomeScreenState, Stage(..), SearchLocationModelType(..), LocationListItemState)
import Storage (KeyStore(..), setValueToLocalStore, updateLocalStage)
import Types.App (FlowBT)

data Route = HomeRoute HomeScreenState | WalletRoute HomeScreenState | ProfileRoute HomeScreenState | BookingRoute HomeScreenState

data Action = SelectHome | SelectWallet | SelectProfile | ProfileAction Profile.Action | Original Home.Action
  | SuggestionsLoaded Boolean (Array Places.Suggestion)
  | PlaceLoaded Boolean Places.Place
  | PlacesFailed String
  | OpenBooking
  | GpsAddress Number Number String

instance showDevelopmentAction :: Show Action where
  show _ = ""

-- Do not forward addresses or development identity/session events to legacy analytics.
instance loggableDevelopmentAction :: Loggable Action where
  performLog _ _ = pure unit

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
  case next of
    HomeRoute home -> loop home
    WalletRoute home -> section false home
    ProfileRoute home -> section true home
    BookingRoute home -> booking home

section :: Boolean -> HomeScreenState -> FlowBT String Unit
section profile home = do
  next <- lift $ lift $ runScreen
    { initialState: home
    , name: if profile then "BrProfile" else "BrWallet"
    , globalEvents: []
    , view: \push state -> shell push (if profile then "Perfil" else "Carteira")
        (if profile then ProfileView.view (push <<< ProfileAction)
          (ProfileData.initData {data {name = state.data.settingSideBar.name}, props {profileLoaded = true}})
         else linearLayout [width MATCH_PARENT, height MATCH_PARENT, orientation VERTICAL, padding (Padding 24 32 24 24), background "#FFFFFF"]
           [textView [text "Carteira", textSize 24, color "#242424"]
           ,textView [text "A carteira ainda não está disponível. Pagamentos e movimentações financeiras não estão habilitados nesta versão.", textSize 16, color "#666666", padding (PaddingTop 24)]])
    , eval
    }
  case next of
    HomeRoute state -> loop state
    WalletRoute state -> section false state
    ProfileRoute state -> section true state
    BookingRoute state -> booking state

booking :: HomeScreenState -> FlowBT String Unit
booking home = do
  Booking.start {lat:home.props.sourceLat,lng:home.props.sourceLong,address:home.data.source}
    {lat:home.props.destinationLat,lng:home.props.destinationLong,address:home.data.destination}
  loop home

homeContent :: forall w. (Action -> Effect Unit) -> HomeScreenState -> PrestoDOM (Effect Unit) w
homeContent push state = linearLayout [width MATCH_PARENT,height MATCH_PARENT,orientation VERTICAL]
  [linearLayout [width MATCH_PARENT,height (V 0),weight 1.0] [HomeView.view (push <<< Original) state]
  ,GeoAttribution.view
  ,linearLayout [width MATCH_PARENT,height WRAP_CONTENT,visibility (if ready then VISIBLE else GONE)]
    [Trip.button (\action -> case action of
        PrimaryButton.OnClick -> push OpenBooking
        _ -> pure unit) (if storedRide then "Acompanhar viagem" else "Ver estimativa") true]]
  where
  storedRide = unsafePerformEffect Rides.hasStoredRide
  ready = state.props.currentStage==HomeScreen && unsafePerformEffect Rides.enabled
    && (storedRide || (state.props.destinationPlaceId/=Nothing && (state.props.sourceLat/=0.0 || state.props.sourceLong/=0.0)))

shell :: forall w. (Action -> Effect Unit) -> String -> PrestoDOM (Effect Unit) w -> PrestoDOM (Effect Unit) w
shell push selected content = linearLayout
  ([width MATCH_PARENT, height MATCH_PARENT, orientation VERTICAL, background "#FFFFFF"]
    <> if selected == "Início" || selected == "" then [] else [onBackPressed push (const SelectHome)])
  [linearLayout [width MATCH_PARENT, height (V 0), weight 1.0] [content]
  ,linearLayout [width MATCH_PARENT, height (V 64), orientation HORIZONTAL, background "#FFFFFF", visibility (if selected == "" then GONE else VISIBLE)]
    (map (\item -> linearLayout
      [width (V 0), weight 1.0, height MATCH_PARENT, orientation VERTICAL, gravity CENTER
      ,onClick push (const item.action), accessibilityHint item.label]
      [imageView [width (V 24), height (V 24), imageWithFallback (fetchImage FF_ASSET item.icon)]
      ,textView [text item.label, textSize 12, color (if selected == item.label then "#111111" else "#858585"), padding (PaddingTop 4)]])
      [{label: "Início", icon: "ny_ic_home", action: SelectHome}
      ,{label: "Carteira", icon: "ny_ic_wallet", action: SelectWallet}
      ,{label: "Perfil", icon: "ny_ic_user_filled_dark", action: SelectProfile}])]

screen :: HomeScreenState -> Screen Action HomeScreenState Route
screen initialState =
  { initialState
  , view: \push state -> shell push (if state.props.currentStage == HomeScreen then "Início" else "") (homeContent push state)
  , name: "HomeScreen"
  , globalEvents:
      [ \push -> Geocoding.subscribe (\lat lng address -> push $ GpsAddress lat lng address)
          (\lat lng -> push $ Original $ Home.UpdateCurrentLocation lat lng)
      , \push -> do
          JB.requestLocation unit
          JB.getCurrentPosition push (\lat lng -> Original $ Home.UpdateCurrentLocation lat lng)
          pure (pure unit)
      , \push -> Places.subscribe (\field items -> push $ SuggestionsLoaded field items) (\field place -> push $ PlaceLoaded field place) (push <<< PlacesFailed)
      ]
  , eval
  }

eval :: Action -> HomeScreenState -> Eval Action Route HomeScreenState
eval SelectHome state = exit (HomeRoute state)
eval SelectWallet state = exit (WalletRoute state)
eval SelectProfile state = exit (ProfileRoute state)
eval (GpsAddress lat lng address) state
  | state.props.sourcePlaceId /= Nothing || state.props.currentStage /= HomeScreen = continue state
  | state.props.sourceLat /= lat || state.props.sourceLong /= lng = continue state
  | state.data.source == address = continue state
  | otherwise = continue state {data {source = address, sourceAddress = HomeData.dummyAddress {street = Just address}}}
eval OpenBooking state = exit (BookingRoute state)
eval (ProfileAction (Profile.BackPressed _)) state = exit (HomeRoute state)
eval (ProfileAction (Profile.GenericHeaderActionController Header.PrefixImgOnClick)) state = exit (HomeRoute state)
eval (ProfileAction (Profile.EditProfile _)) state = do
  _ <- pure $ unsafePerformEffect $ showToast "Edição de perfil indisponível no modo de teste sem autenticação."
  continue state
eval (ProfileAction _) state = continue state
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
          {markerId = if field then "ny_ic_src_marker" else "ny_ic_dest_marker", pointerIcon = if field then "yatri_map_origin" else "yatri_map_destination"}
          place.lat place.lng 80 0.5 (if field then 0.5 else 0.95) (getNewIDWithTag "CustomerHomeScreen")
        pure (Original Home.NoAction)
    ]

suggestionItem :: Places.Suggestion -> LocationListItemState
suggestionItem item =
  { prefixImageUrl: "ny_ic_loc_grey,", postfixImageUrl: "", postfixImageVisibility: false
  , lat: Nothing, lon: Nothing, placeId: Just item.placeId, subTitle: item.subTitle, title: item.title
  , description: item.address, tag: "", tagType: Nothing, cardType: Nothing, address: item.address
  , tagName: "", isEditEnabled: false, savedLocation: "", placeName: item.title, isClickable: true
  , alpha: 1.0, fullAddress: HomeData.dummyAddress, locationItemType: Nothing, distance: Nothing
  , showDistance: Just false, actualDistance: Nothing, frequencyCount: Nothing, recencyDate: Nothing
  , locationScore: Nothing, dynamicAction: Nothing, types: Nothing
  }

evalHome :: Home.Action -> HomeScreenState -> Eval Action Route HomeScreenState
-- No profile, saved-address, offers, safety, scheduled-ride, analytics or push polling is started here.
evalHome (Home.UpdateCurrentLocation latitude longitude) state = position state latitude longitude
evalHome (Home.CurrentLocation latitude longitude) state = position state latitude longitude
evalHome (Home.MAPREADY _ _ _) state = do
  when (JB.isLocationPermissionEnabledWithoutEff unit) $ void $ pure $ JB.enableMyLocation true
  continueWithCmd state [do
    restoreMap state
    pure (Original Home.NoAction)]

evalHome Home.RecenterCurrentLocation state = continueWithCmd state
  [do
    recenter
    pure (Original Home.NoAction)]

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
  _ <- pure $ JB.removeMarker "ny_ic_src_marker"
  continue state {data {source = "", sourceAddress = HomeData.dummyAddress, locationList = []}, props {sourcePlaceId = Nothing, sourceLat = 0.0, sourceLong = 0.0, searchLocationModelProps {crossBtnSrcVisibility = false, showLoader = false}}}
evalHome (Home.SearchLocationModelActionController Search.DestinationClear) state = do
  _ <- pure $ unsafePerformEffect Places.cancel
  _ <- pure $ JB.removeMarker "ny_ic_dest_marker"
  continue state {data {destination = "", destinationAddress = HomeData.dummyAddress, locationList = []}, props {destinationPlaceId = Nothing, destinationLat = 0.0, destinationLong = 0.0, searchLocationModelProps {crossBtnDestVisibility = false, showLoader = false}}}
evalHome (Home.SearchLocationModelActionController Search.SetCurrentLocation) state = do
  _ <- pure $ unsafePerformEffect Places.cancel
  _ <- pure $ updateLocalStage HomeScreen
  exit (HomeRoute (state {data {source = "Localização atual", sourceAddress = HomeData.dummyAddress}, props {sourcePlaceId = Nothing, sourceLat = 0.0, sourceLong = 0.0, isSource = Just true, currentStage = HomeScreen}}))
evalHome (Home.SearchLocationModelActionController Search.RecenterCurrentLocation) state = evalHome Home.RecenterCurrentLocation state
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

unavailable :: HomeScreenState -> Eval Action Route HomeScreenState
unavailable state = do
  _ <- pure $ unsafePerformEffect $ showToast "Corridas ainda não conectadas ao backend de desenvolvimento."
  continue state

position :: HomeScreenState -> String -> String -> Eval Action Route HomeScreenState
position state latitude longitude = case fromString latitude, fromString longitude of
  Just lat, Just lng | lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0 && (lat /= 0.0 || lng /= 0.0) -> do
    let label = "Localização atual"
    if state.props.sourcePlaceId /= Nothing then
      continue state {props {currentLocation {lat = lat, lng = lng, place = label}}}
    else continueWithCmd state
      { props {sourceLat = lat, sourceLong = lng, currentLocation {lat = lat, lng = lng, place = label}}
      , data {source = if state.props.currentStage == HomeScreen && (state.props.sourceLat /= lat || state.props.sourceLong /= lng) then label else state.data.source}
      }
      [ do
          Geocoding.resolve lat lng
          when (state.props.destinationPlaceId == Nothing || state.props.isSource == Just true) $ JB.animateCamera lat lng 16.0 "ZOOM"
          pure (Original Home.NoAction)
      ]
  _, _ -> continue state

-- A map may become ready after the search overlay closes; repaint only real selected points.
restoreMap :: HomeScreenState -> Effect Unit
restoreMap state = do
  case state.props.sourcePlaceId of
    Just _ -> marker true state.props.sourceLat state.props.sourceLong
    Nothing -> pure unit
  case state.props.destinationPlaceId of
    Just _ -> marker false state.props.destinationLat state.props.destinationLong
    Nothing -> pure unit
  if state.props.isSource == Just true || state.props.destinationPlaceId == Nothing then
    when (state.props.sourceLat /= 0.0 || state.props.sourceLong /= 0.0) $
      JB.animateCamera state.props.sourceLat state.props.sourceLong 16.0 "ZOOM"
  else JB.animateCamera state.props.destinationLat state.props.destinationLong 16.0 "ZOOM"
  where
  marker field lat lng = void $ JB.showMarker JB.defaultMarkerConfig
    {markerId = if field then "ny_ic_src_marker" else "ny_ic_dest_marker", pointerIcon = if field then "yatri_map_origin" else "yatri_map_destination"}
    lat lng 80 0.5 (if field then 0.5 else 0.95) (getNewIDWithTag "CustomerHomeScreen")

-- Recentring the map must not erase a manually selected origin or destination.
recenter :: Effect Unit
recenter = do
  JB.requestLocation unit
  JB.getCurrentPositionWithTimeout (\point -> case fromString point.lat, fromString point.lng of
    Just lat, Just lng | lat >= -90.0 && lat <= 90.0 && lng >= -180.0 && lng <= 180.0 && (lat /= 0.0 || lng /= 0.0) -> do
      Geocoding.position point.lat point.lng
      JB.animateCamera lat lng 16.0 "ZOOM"
    _, _ -> showToast "Localização indisponível. Ative o GPS ou pesquise um endereço.")
    (\lat lng _ -> {lat, lng}) 8000 false
