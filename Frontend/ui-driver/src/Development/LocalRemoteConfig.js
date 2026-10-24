// SPDX-License-Identifier: AGPL-3.0-or-later
import * as original from '../../output/Common.RemoteConfig.Utils/foreign.js?br-driver-original-config';
import {enabled} from './Driver.js';
// Explicit local configuration, copied from the original PureScript defaults.
// Optional Indian operational features remain disabled; these are not API data.
const local = {
  perf_config:{default:{disableBannerAnimation:false,mapRecenter:true}},
  profile_completion_reminder:{reminderDuration:86400},
  stop_validation_distance_threshold:{distance:200,enableStopValidation:true},
  coin_cancellation_time_threshold_config:{cancellationTimeThresholdInSeconds:120},
  events_config:{enabled:false,pushEventChunkSize:10,loggingIntervalInMs:10000},
  cancellation_rate_thresholds:{default:{warning1:30,warning2:60}},
  enable_hotspots_feature:{default:{enableHotspotsFeature:false}},
  enable_scheduled_rides:{default:{enableScheduledRides:false}}
};
export const fetchRemoteConfigString = key => enabled() && Object.prototype.hasOwnProperty.call(local,key)
  ? JSON.stringify(local[key]) : original.fetchRemoteConfigString(key);
export const fetchRemoteConfig = fetchRemoteConfigString;
export const isWhiteListed = original.isWhiteListed;
