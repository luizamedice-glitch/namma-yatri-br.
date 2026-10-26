-- SPDX-License-Identifier: AGPL-3.0-or-later
module Development.Geocoding where
import Prelude
import Effect (Effect)
foreign import subscribe :: (Number -> Number -> String -> Effect Unit) -> (String -> String -> Effect Unit) -> Effect (Effect Unit)
foreign import resolve :: Number -> Number -> Effect Unit
foreign import position :: String -> String -> Effect Unit
