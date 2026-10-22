#!/usr/bin/env python3
"""Regression: a later batch must not inherit unrelated earlier sources."""
import importlib.util
from pathlib import Path
import unittest
spec = importlib.util.spec_from_file_location('diagnostics', Path(__file__).with_name('diagnose-purescript.py'))
diag = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diag)

class Batches(unittest.TestCase):
    def test_independent_branches_and_shared_imports(self):
        graph = {'Base': {'depends': []}, 'Left': {'depends': ['Base']},
                 'Right': {'depends': ['Base']}, 'Main': {'depends': ['Right']}}
        batches = diag.dependency_batches(graph, list(graph), 1)
        self.assertEqual(batches[2]['sources'], ['Base', 'Right'])
        self.assertEqual(batches[3]['sources'], ['Base', 'Right', 'Main'])
        self.assertEqual([n for b in batches for n in b['targets']], list(graph))

    def test_heavy_controller_is_not_grouped_with_other_targets(self):
        graph = {n: {'depends': []} for n in ['Before', 'Screens.HomeScreen.Controller', 'After']}
        batches = diag.dependency_batches(graph, list(graph), 25)
        self.assertEqual([b['targets'] for b in batches], [[n] for n in graph])

if __name__ == '__main__':
    unittest.main()
