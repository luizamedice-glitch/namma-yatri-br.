// Reproducible inventory of the original sources selected for the Brazilian adaptation.
// This checks provenance, not visual fidelity or execution of the legacy runtime.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const groups = {
  passenger: [
    'Frontend/ui-customer/src/Screens/RideBookingFlow/HomeScreen/View.purs',
    'Frontend/ui-customer/src/Screens/RideBookingFlow/HomeScreen/ComponentConfig.purs',
    'Frontend/ui-customer/src/Screens/RideBookingFlow/HomeScreen/ScreenData.purs',
    'Frontend/ui-customer/src/Screens/SearchLocationFlow/SearchLocationScreen/View.purs',
    'Frontend/ui-customer/src/Screens/CustomerUtils/RideSelectionScreen/View.purs',
    'Frontend/ui-customer/src/MerchantConfigs/DefaultConfig.purs',
    'Frontend/android-native/app/src/user/nammaYatri/assets/juspay/index_bundle.js'
  ],
  driver: [
    'Frontend/ui-driver/src/Screens/HomeScreen/View.purs',
    'Frontend/ui-driver/src/Screens/HomeScreen/ScreenData.purs',
    'Frontend/ui-driver/src/Screens/HomeScreen/ComponentConfig.purs',
    'Frontend/ui-driver/src/Components/RideActionModal/View.purs',
    'Frontend/ui-driver/src/Components/RideAllocationModal/View.purs',
    'Frontend/ui-driver/src/Components/RideRequestCard/View.purs',
    'Frontend/android-native/app/src/driver/nammaYatriPartner/assets/juspay/index_bundle.js'
  ],
  shared: [
    'Frontend/ui-common/src/Components/PrimaryButton/View.purs',
    'Frontend/ui-common/src/Components/PrimaryButton/Controller.purs',
    'Frontend/ui-common/src/Font/Style.purs',
    'Frontend/ui-common/src/Font/Size.purs',
    'Frontend/packages.dhall',
    'Frontend/android-native/app/src/main/assets/fonts/PlusJakartaSans-Regular.ttf',
    'Frontend/android-native/app/src/main/assets/fonts/PlusJakartaSans-SemiBold.ttf'
  ]
};
const manifest = { schema: 1, purpose: 'provenance-only; does not certify visual fidelity', groups: {} };
for (const [group, sources] of Object.entries(groups)) {
  manifest.groups[group] = await Promise.all(sources.map(async source => {
    const data = await readFile(path.join(root, source));
    return { source, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }));
}
const output = new URL('../original-ui-manifest.json', import.meta.url);
const json = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--verify')) {
  if (await readFile(output, 'utf8') !== json) throw new Error('Os fontes originais mudaram; reveja a adaptação e atualize explicitamente o inventário');
  console.log('21 fontes/recursos originais conferidos; isso não comprova fidelidade visual.');
} else {
  await writeFile(output, json);
  console.log('Inventário dos fontes originais gravado.');
}
