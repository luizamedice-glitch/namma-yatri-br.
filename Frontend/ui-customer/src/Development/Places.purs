-- SPDX-License-Identifier: AGPL-3.0-or-later
module Development.Places where

import Prelude
import Effect (Effect)

type Suggestion = {placeId :: String, address :: String, title :: String, subTitle :: String}
type Place = {placeId :: String, address :: String, lat :: Number, lng :: Number}

foreign import subscribe :: (Boolean -> Array Suggestion -> Effect Unit) -> (Boolean -> Place -> Effect Unit) -> (String -> Effect Unit) -> Effect (Effect Unit)
foreign import inputChanged :: String -> Boolean -> Effect Unit
foreign import autocomplete :: String -> Boolean -> Number -> Number -> Effect Unit
foreign import details :: String -> Boolean -> Effect Unit
foreign import cancel :: Effect Unit
