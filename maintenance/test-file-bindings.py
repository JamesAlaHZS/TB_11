"""Regression checks for required iOS folder bindings in the exported deliveries."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = json.loads((ROOT / 'maintenance/file-bindings-fixtures.json').read_text(encoding='utf8'))


def validate(actions):
    outputs = {a['WFWorkflowActionParameters']['UUID']: a for a in actions
               if 'UUID' in a['WFWorkflowActionParameters']}
    for action in actions:
        kind = action['WFWorkflowActionIdentifier'].removeprefix('is.workflow.actions.')
        params = action['WFWorkflowActionParameters']
        if kind in ['file.createfolder', 'documentpicker.save']:
            assert params.get('WFFolder'), 'missing WFFolder'
            folder = params['WFFolder']
            if 'fileLocation' in folder:
                location = folder['fileLocation']
                assert location['WFFileLocationType'] == 'Shortcuts'
                assert location['appContainerBundleIdentifier'] == 'com.apple.shortcuts'
                assert location['relativeSubpath'] == ''
                assert 'crossDeviceItemID' not in location
                assert 'bookmarkData' not in folder
            else:
                source = outputs[folder['Value']['OutputUUID']]
                assert source['WFWorkflowActionIdentifier'].endswith('.file.createfolder')
                assert source['WFWorkflowActionParameters']['WFFilePath'] == 'abc'
                assert params['WFFilePath'] == 'cookie'
            if kind == 'file.createfolder':
                assert params['WFFilePath']
            else:
                assert params['WFAskWhereToSave'] is False
                assert params['WFFileDestinationPath']
                assert params['WFInput']
        elif kind == 'documentpicker.open':
            assert params['WFFile']['fileLocation']['WFFileLocationType'] == 'Shortcuts'
            assert params['WFShowFilePicker'] is False
            assert params['WFGetFolderContents'] is False
            assert params['WFGetFilePath']
        elif kind == 'file.getfoldercontents':
            source = outputs[params['WFFolder']['Value']['OutputUUID']]
            assert source['WFWorkflowActionParameters']['WFFilePath'] == 'cookie'


class FileBindings(unittest.TestCase):
    def test_deliveries_match_fixture_hashes(self):
        for fixture in FIXTURES:
            with self.subTest(file=fixture['file']):
                data = (ROOT / 'shortcuts' / fixture['file']).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), fixture['signed_sha256'])

    def test_all_required_file_parameters(self):
        for fixture in FIXTURES:
            with self.subTest(file=fixture['file']):
                validate(fixture['actions'])

    def test_old_failure_is_rejected(self):
        for fixture in FIXTURES:
            actions = json.loads(json.dumps(fixture['actions']))
            action = next(a for a in actions if a['WFWorkflowActionIdentifier'].endswith('.file.createfolder'))
            del action['WFWorkflowActionParameters']['WFFolder']
            with self.assertRaisesRegex(AssertionError, 'missing WFFolder'):
                validate(actions)


if __name__ == '__main__':
    unittest.main()
