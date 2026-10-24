import importlib.util, unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
spec=importlib.util.spec_from_file_location('driver_ops',Path(__file__).parents[1]/'ops/deploy-driver-pilot.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
class CaddyTests(unittest.TestCase):
    def test_update_preserves_existing_window_and_refuses_expired_window(self):
        now=datetime(2026,10,24,tzinfo=timezone.utc)
        until=(now+timedelta(days=2)).isoformat()
        previous={'services':{'driver-pilot':{'environment':{'YATRI_DRIVER_PILOT_UNTIL':until}}}}
        self.assertEqual(ops.pilot_expiration(previous,now),until)
        with self.assertRaises(RuntimeError):ops.pilot_expiration(previous,now+timedelta(days=3))
        with self.assertRaises(RuntimeError):ops.pilot_expiration({},now)
    def test_exact_routes_and_idempotent_preservation(self):
        source='52-67-246-31.sslip.io {\n    # maps and health remain\n    handle /health {\n        reverse_proxy 127.0.0.1:8080\n    }\n    respond 403\n}\n'
        candidate=ops.caddy_config(source)
        self.assertEqual(ops.caddy_config(candidate),candidate)
        self.assertIn('handle /health',candidate)
        self.assertEqual(candidate.count(ops.BEGIN),1)
        self.assertNotIn('/v1/auth',candidate)
        self.assertIn('path_regexp pilotRideAction',candidate)
        self.assertIn('/(accept|reject|arrive|start|complete|cancel)$',candidate)
        self.assertIn('method GET\n        path /v1/snapshot',candidate)
        self.assertIn('method POST\n        path /v1/driver/location /v1/driver/availability /v1/driver/pair',candidate)
    def test_ambiguous_or_absent_target_is_rejected(self):
        for config in ['other.example {\n}\n','52-67-246-31.sslip.io {\n}\n52-67-246-31.sslip.io {\n}\n']:
            with self.assertRaises(RuntimeError):ops.caddy_config(config)
if __name__=='__main__':unittest.main()
