// SPDX-License-Identifier: AGPL-3.0-or-later
// Stable FFI contract: runtime-only fixes can reuse compiled PureScript output.
import {callbackMapper} from 'presto-ui';
import {createGeocoding} from '../../src/Development/GeocodingRuntime.mjs';
const runtime=createGeocoding(callbackMapper);
export const subscribe=runtime.subscribe;
export const resolve=runtime.resolve;
export const position=runtime.position;
