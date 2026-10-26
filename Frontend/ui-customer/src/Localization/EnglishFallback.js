// SPDX-License-Identifier: AGPL-3.0-or-later
// The query bypasses our module adapter, keeping the validated original available.
import {getEn as original} from '../../output/Resources.LocalizableV2.EN/index.js?br-original-locale';
import {createPortugueseRecord} from './Runtime.js';
export const getEn = createPortugueseRecord(original);
