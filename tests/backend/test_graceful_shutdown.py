"""Run the generated managed service and inspect its actual procd arguments."""
import os, subprocess, tempfile, unittest
from pathlib import Path
from test_next_profiles import LIB

class GracefulShutdown(unittest.TestCase):
    def test_service_allows_fakeip_cache_flush_before_forced_kill(self):
        code='let fs=require("fs");let p=ARGV[0]+"/singbox/service_script.uc";print(fs.stat(p)?require("singbox.service_script").text("fixture"):"");'
        run=subprocess.run(['ucode','-L',str(LIB),'-e',code,str(LIB)],capture_output=True,text=True)
        self.assertEqual(run.returncode,0,run.stderr)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'service';path.write_text(run.stdout)
            shell='config_load(){ :; }; config_get_bool(){ eval "$1=1"; }; config_get(){ eval "$1=fixture"; }; procd_open_instance(){ :; }; procd_close_instance(){ :; }; procd_set_param(){ printf "%s\\n" "$*"; }; source "$1"; start_service'
            service=subprocess.run(['bash','-c',shell,'bash',str(path)],capture_output=True,text=True)
            self.assertEqual(service.returncode,0,service.stderr)
            self.assertIn('term_timeout 30',service.stdout.splitlines())
