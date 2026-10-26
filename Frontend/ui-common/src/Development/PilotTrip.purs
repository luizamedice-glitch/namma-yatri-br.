-- SPDX-License-Identifier: AGPL-3.0-or-later
module Development.PilotTrip where
import Prelude
import Effect (Effect)
import PrestoDOM (PrestoDOM,Length(..),Orientation(..),Padding(..),width,height,orientation,padding,background,textView,text,textSize,color,linearLayout,afterRender,id,weight)
import Engineering.Helpers.Commons (getNewIDWithTag)
import Components.PrimaryButton as PB
import Components.SourceToDestination as Addresses

type Trip = {id :: String, phase :: String, origin :: String, destination :: String,
  fare :: String, distance :: String, passenger :: String, driver :: String, vehicle :: String, polyline :: String, driverLat :: Number, driverLng :: Number, gpsFresh :: Boolean, tracking :: String}

emptyTrip :: Trip
emptyTrip = {id:"",phase:"idle",origin:"",destination:"",fare:"",distance:"",passenger:"",driver:"",vehicle:"",polyline:"",driverLat:0.0,driverLng:0.0,gpsFresh:false,tracking:""}

heading :: forall w. String -> PrestoDOM (Effect Unit) w
heading value = textView [text value,textSize 22,color "#242424",padding (Padding 20 20 20 12)]

card :: forall action w. (action -> Effect Unit) -> action -> Trip -> PrestoDOM (Effect Unit) w
card push noop trip = linearLayout [width MATCH_PARENT,height WRAP_CONTENT,orientation VERTICAL,padding (Padding 20 16 20 16),background "#FFFFFF"]
  [Addresses.view (const $ push noop) (Addresses.config
    {sourceTextConfig {text=trip.origin},destinationTextConfig {text=trip.destination}
    ,sourceImageConfig {imageUrl="ny_ic_source_dot"},destinationImageConfig {imageUrl="ny_ic_destination"}
    ,showDestination=true})
  ,textView [text trip.distance,textSize 16,padding (PaddingTop 16),color "#666666"]
  ,textView [text trip.fare,textSize 26,padding (PaddingTop 12),color "#242424"]]

button :: forall w. (PB.Action -> Effect Unit) -> String -> Boolean -> PrestoDOM (Effect Unit) w
button push label active = PB.view push (PB.config {id="br-trip-"<>label,textConfig {text=label,accessibilityHint=label},isClickable=active,alpha=if active then 1.0 else 0.5})

foreign import mountMap :: String -> Effect Unit

mapView :: forall w. PrestoDOM (Effect Unit) w
mapView = linearLayout [id mapId,width MATCH_PARENT,height (V 0),weight 1.0,
  afterRender (const $ mountMap mapId) (const unit)] []
  where
  mapId = getNewIDWithTag "BrActiveTripMap"
