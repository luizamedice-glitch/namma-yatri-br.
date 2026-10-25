-- SPDX-License-Identifier: AGPL-3.0-or-later
module Development.GeoAttribution (view) where
import Prelude
import Effect (Effect)
import JBridge as JB
import PrestoDOM (PrestoDOM,Length(..),Orientation(..),Gravity(..),Padding(..),linearLayout,textView,width,height,orientation,gravity,padding,text,textSize,color,onClick)
view :: forall w. PrestoDOM (Effect Unit) w
view = linearLayout [width MATCH_PARENT,height WRAP_CONTENT,orientation HORIZONTAL,gravity CENTER,padding (Padding 4 3 4 3)]
  [textView [text "Endereços: Geoapify",textSize 10,color "#666666",onClick (\_ -> JB.openUrlInApp "https://www.geoapify.com/") (const unit)]
  ,textView [text " · © OpenStreetMap",textSize 10,color "#666666",onClick (\_ -> JB.openUrlInApp "https://www.openstreetmap.org/copyright") (const unit)]]
