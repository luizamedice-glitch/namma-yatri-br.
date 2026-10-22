-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Brazilian mobile numbers: two-digit DDD followed by nine digits, starting with 9.
module Engineering.Helpers.BrazilianMobileNumber (isValid, isValidPrefix) where

import Prelude
import Data.Array (elem)
import Data.Foldable (all)
import Data.String.CodeUnits (length, take, drop, toCharArray)

isValidPrefix :: String -> Boolean
isValidPrefix value =
  let size = length value
      ddd = take 2 value
  in size <= 11
    && all (\digit -> digit >= '0' && digit <= '9') (toCharArray value)
    && (size == 0 || take 1 value /= "0")
    && (size < 2 || elem ddd validDDDs)
    && (size < 3 || take 1 (drop 2 value) == "9")

isValid :: String -> Boolean
isValid value = length value == 11 && isValidPrefix value

validDDDs :: Array String
validDDDs =
  [ "11", "12", "13", "14", "15", "16", "17", "18", "19"
  , "21", "22", "24", "27", "28", "31", "32", "33", "34", "35", "37", "38"
  , "41", "42", "43", "44", "45", "46", "47", "48", "49"
  , "51", "53", "54", "55", "61", "62", "63", "64", "65", "66", "67", "68", "69"
  , "71", "73", "74", "75", "77", "79", "81", "82", "83", "84", "85", "86", "87", "88", "89"
  , "91", "92", "93", "94", "95", "96", "97", "98", "99"
  ]
