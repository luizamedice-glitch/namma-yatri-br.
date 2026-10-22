#!/usr/bin/env python3
"""Test the production Java policy without Android/API mocks or additional dependencies."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
source = root / 'android-native/mobility-common/src/main/java/in/juspay/mobility/common/DevelopmentConfigDiagnostics.java'
with tempfile.TemporaryDirectory(prefix='yatri-diagnostics-') as directory:
    test = Path(directory) / 'PolicyTest.java'
    test.write_text('''
import in.juspay.mobility.common.DevelopmentConfigDiagnostics;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
public final class PolicyTest {
  public static void main(String[] args) {
    DevelopmentConfigDiagnostics p = new DevelopmentConfigDiagnostics();
    if (p.isDevelopmentConfigWarning(false, "Config Decode Failed - field")) throw new AssertionError("release changed");
    if (p.isDevelopmentConfigWarning(true, "Servidor indisponível")) throw new AssertionError("operational error changed");
    if (p.isDevelopmentConfigWarning(true, null)) throw new AssertionError("null classified");
    if (!p.isDevelopmentConfigWarning(true, "Config Decode Failed - field")) throw new AssertionError("debug diagnostic missed");
    AtomicInteger visible = new AtomicInteger();
    IntStream.range(0, 100).parallel().forEach(i -> {
      String notice = p.nextVisibleNotice();
      if (notice != null) {
        if (!notice.contains("log")) throw new AssertionError("missing diagnostic notice");
        visible.incrementAndGet();
      }
    });
    if (visible.get() != 1) throw new AssertionError("notice queue: " + visible.get());
    if (new DevelopmentConfigDiagnostics().nextVisibleNotice() == null) throw new AssertionError("new session missing notice");
    System.out.println("PASS: release and operational messages unchanged; one BR config notice per bridge, including concurrent calls.");
  }
}
''')
    subprocess.run(['javac', '--release', '8', '-encoding', 'UTF-8', '-d', directory, str(source), str(test)], check=True)
    subprocess.run(['java', '-cp', directory, 'PolicyTest'], check=True)
