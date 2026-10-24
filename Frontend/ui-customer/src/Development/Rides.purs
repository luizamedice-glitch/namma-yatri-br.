module Development.Rides where
import Prelude
import Effect (Effect)
import Development.PilotTrip (Trip)
type Point = {lat :: Number,lng :: Number,address :: String}
foreign import enabled :: Effect Boolean
foreign import subscribe :: Point -> Point -> (Trip -> Effect Unit) -> (String -> Effect Unit) -> Effect (Effect Unit)
foreign import request :: Effect Unit
foreign import cancel :: Effect Unit
foreign import dismiss :: Effect Unit
