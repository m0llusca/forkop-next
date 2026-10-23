import os,pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[2];LIB=ROOT/'forkop/files/usr/lib'
class ForkIdentityTests(unittest.TestCase):
    def test_installer_can_report_download_source_without_installing(self):
        r=subprocess.run(['sh',str(ROOT/'install.sh'),'--release-source'],text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(r.stdout.strip(),'m0llusca/forkop-next')
    def test_component_updater_defaults_to_our_fork(self):
        env=dict(os.environ);env.pop('FORKOP_RELEASE_REPO',None)
        r=subprocess.run(['ucode','-L',str(LIB),str(LIB/'core/constants.uc'),'get','FORKOP_RELEASE_REPO'],env=env,text=True,capture_output=True)
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertEqual(r.stdout.strip(),'m0llusca/forkop-next','updating our fork must not replace it with original Forkop')
    def test_release_repository_can_be_overridden_for_testing(self):
        env=dict(os.environ,FORKOP_RELEASE_REPO='fixture/project')
        r=subprocess.run(['ucode','-L',str(LIB),str(LIB/'core/constants.uc'),'get','FORKOP_RELEASE_REPO'],env=env,text=True,capture_output=True)
        self.assertEqual(r.stdout.strip(),'fixture/project')
if __name__=='__main__':unittest.main()
