"""The real lifecycle must call transactions before touching router runtime."""
import json, os, shutil, subprocess, tempfile, unittest
from pathlib import Path
from test_next_profiles import LIB

class NativeLifecycle(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.dir=Path(self.temp.name);self.lib=self.dir/'lib';shutil.copytree(LIB,self.lib)
        self.event=self.dir/'event'
        self.env=dict(os.environ,FORKOP_LIB=str(self.lib),FORKOP_RUNTIME_STATE_DIR=str(self.dir/'run'),FORKOP_CONFIG_FILE=str(self.dir/'forkop'),FORKOP_TEST_EVENT=str(self.event))

    def test_native_reload_delegates_to_transaction_before_runtime_mutation(self):
        (self.lib/'service/next.uc').write_text('let fs=require("fs");fs.writefile(getenv("FORKOP_TEST_EVENT"),ARGV[1]);print(sprintf("%J",{success:true,data:{}}));')
        run=subprocess.run(['ucode','-L',str(self.lib),str(self.lib/'service/lifecycle.uc'),'reload'],env=self.env,capture_output=True,text=True,timeout=15)
        self.assertEqual(run.returncode,0,run.stdout+run.stderr)
        self.assertEqual(self.event.read_text(),'native_apply')
