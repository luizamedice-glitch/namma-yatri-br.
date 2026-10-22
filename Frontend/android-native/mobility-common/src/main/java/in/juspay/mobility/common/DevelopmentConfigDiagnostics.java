// SPDX-License-Identifier: AGPL-3.0-or-later
package in.juspay.mobility.common;

import java.util.concurrent.atomic.AtomicBoolean;

/** Presentation policy only: the original decoder and its local defaults remain unchanged. */
public final class DevelopmentConfigDiagnostics {
    private final AtomicBoolean noticeShown = new AtomicBoolean(false);

    public boolean isDevelopmentConfigWarning(boolean developmentBuild, String message) {
        return developmentBuild && message != null && message.startsWith("Config Decode Failed");
    }

    public String nextVisibleNotice() {
        return noticeShown.compareAndSet(false, true)
                ? "Configuração legada incompleta. Detalhes no log."
                : null;
    }
}
