import importlib.util,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
ops=load('alce_ops',ROOT/'ops/alce/maintenance.py')
install=load('alce_install',ROOT/'ops/alce/install-maintenance.py')

class AlceMaintenance(unittest.TestCase):
    def test_isolated_database_selection_never_uses_namma_compose(self):
        calls=[]
        def docker(*args):
            calls.append(args)
            if '--format' in args:return 'sha256:'+'0'*64
            return json.dumps([{'State':{'Running':True},'Config':{'Env':['POSTGRES_DB=alce_lab','POSTGRES_USER=alce_fixture']},'Id':'isolated-container'}])
        original=ops.engine.docker;self.addCleanup(setattr,ops.engine,'docker',original)
        ops.engine.docker=docker
        self.assertEqual(ops.live(),('isolated-container','sha256:'+'0'*64,'alce_fixture','alce_lab'))
        self.assertEqual(calls,[('inspect','alce-lab-postgres'),('inspect','--format','{{.Image}}','alce-lab-compat')])

    def test_database_mismatch_is_refused_before_dump(self):
        original=ops.engine.docker;self.addCleanup(setattr,ops.engine,'docker',original)
        ops.engine.docker=lambda *args:json.dumps([{'State':{'Running':True},'Config':{'Env':['POSTGRES_DB=namma_production']}}])
        with self.assertRaisesRegex(RuntimeError,'ISOLATED_DATABASE_REQUIRED'):ops.live()

    def test_shared_engine_is_configured_with_separate_backup_and_state_paths(self):
        self.assertEqual(str(ops.engine.ROOT),'/opt/alce-lab')
        self.assertEqual(str(ops.engine.BACKUPS),'/opt/alce-lab/backups')
        self.assertEqual(str(ops.engine.STATE),'/opt/alce-lab/operations/state')
        self.assertIs(ops.engine.live,ops.live)
        self.assertIs(ops.engine.monitor,ops.monitor)

    def test_timer_services_run_only_alce_operator_commands(self):
        for operation in ['backup','monitor']:
            self.assertIn('/opt/alce-lab/operations/current/maintenance.py '+operation,install.unit(operation))
            self.assertIn('Unit=alce-'+operation+'.service',install.timer(operation))
        self.assertIn('OnCalendar=*-*-* 03:30:00 UTC',install.timer('backup'))
        self.assertIn('OnUnitActiveSec=5min',install.timer('monitor'))

if __name__=='__main__':unittest.main()
