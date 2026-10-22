-- SPDX-License-Identifier: AGPL-3.0-or-later
module Engineering.Helpers.OptionalRemoteConfig (decodeForeignObject) where

import Prelude
import DecodeUtil as Original
import Engineering.Helpers.DevelopmentMode as DevelopmentMode
import Foreign.Generic (class Decode, class Encode, Foreign)

-- Optional remote products use their existing local defaults in the BR development build.
-- Merchant configuration and API response decoders continue to use DecodeUtil directly.
decodeForeignObject :: forall a. Decode (Record a) => Encode (Record a) => Foreign -> Record a -> Record a
decodeForeignObject remote defaults
  | DevelopmentMode.isEnabled unit = defaults
  | otherwise = Original.decodeForeignObject remote defaults
