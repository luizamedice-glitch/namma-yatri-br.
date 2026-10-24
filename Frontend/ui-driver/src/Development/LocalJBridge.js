// SPDX-License-Identifier: AGPL-3.0-or-later
export * from '../../output/JBridge/foreign.js?br-driver-original-bridge';
import {setFCMToken as originalSetFCMToken} from '../../output/JBridge/foreign.js?br-driver-original-bridge';
import {enabled} from './Driver.js';
export const setFCMToken=cb=>action=>()=>{
  if(enabled())return;
  return originalSetFCMToken(cb)(action)();
};
