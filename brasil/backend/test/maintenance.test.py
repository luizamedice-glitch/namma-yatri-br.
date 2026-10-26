import importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from datetime import datetime,timedelta,timezone
spec=importlib.util.spec_from_file_location('maintenance',Path(__file__).resolve().parents[1]/'ops/maintenance.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)

class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.backups=self.root/'backups';self.backups.mkdir();self.state=self.root/'state';self.state.mkdir()
        for key,value in [('ROOT',self.root),('BACKUPS',self.backups),('STATE',self.state)]:
            replacement=patch.object(ops,key,value);replacement.start();self.addCleanup(replacement.stop)
    def backup(self):
        name='yatri-db-20261025T030000123456Z.ybk';file=self.backups/name;file.write_bytes(b'ciphertext fixture')
        meta={'file':name,'createdAt':datetime.now(timezone.utc).isoformat(),'bytes':file.stat().st_size,'sha256':ops.checksum(file),'encrypted':True}
        ops.atomic(file.with_suffix('.json'),meta);return file,meta
    def test_checksum_and_symlink_refusal(self):
        file,meta=self.backup();self.assertEqual(ops.latest(True)[1],meta)
        file.write_bytes(b'changed ciphertext')
        with self.assertRaises(RuntimeError):ops.latest(True)
        file.unlink();file.symlink_to(file.with_suffix('.json'))
        with self.assertRaises(RuntimeError):ops.latest(True)
    def test_monitor_detects_stale_restore_and_unhealthy_api(self):
        self.backup()
        (self.root/'compose.driver-pilot.json').write_text(json.dumps({'services':{'driver-pilot':{'environment':{'YATRI_DRIVER_PILOT_UNTIL':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()}}}}))
        ops.atomic(self.state/'restore-check.json',{'verifiedAt':(datetime.now(timezone.utc)-timedelta(hours=27)).isoformat()})
        with patch.object(ops,'live',return_value=('db','image','user','database')),patch.object(ops,'health',return_value=True):
            report=ops.monitor();self.assertFalse(report['healthy']);self.assertFalse(report['checks']['recentOffsiteRestoreCheck'])
            ops.atomic(self.state/'restore-check.json',{'verifiedAt':datetime.now(timezone.utc).isoformat()})
            self.assertTrue(ops.monitor()['healthy'])
        with patch.object(ops,'live',side_effect=RuntimeError('down')),patch.object(ops,'health',return_value=False):
            report=ops.monitor();self.assertFalse(report['healthy']);self.assertFalse(report['checks']['databaseContainer'])
        self.assertEqual((self.state/'health.json').stat().st_mode&0o777,0o600)

if __name__=='__main__':unittest.main()
