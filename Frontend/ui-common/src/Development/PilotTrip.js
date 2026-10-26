// SPDX-License-Identifier: AGPL-3.0-or-later
import {callbackMapper} from 'presto-ui';
import {mountMapWithMapper} from '../../../ui-common/src/Development/TripMapRuntime.js';
export const mountMap=id=>()=>mountMapWithMapper(id,callbackMapper.map);
