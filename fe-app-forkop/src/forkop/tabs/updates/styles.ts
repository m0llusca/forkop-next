// language=CSS
import { FORKOP_UCI_PACKAGE as FORKOP_CBI_PREFIX } from '../../../constants';

export const styles = `
#cbi-${FORKOP_CBI_PREFIX}-updates-_mount_node > div {
    width: 100%;
}

#cbi-${FORKOP_CBI_PREFIX}-updates > h3 {
    display: none;
}

.fkp_updates-page {
    width: 100%;
    min-width: 0;
}

.fkp_updates-page__components {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
}

.fkp_updates-page__components-column {
    display: flex;
    flex: 1 1 280px;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
}

@media (max-width: 960px) {
    .fkp_updates-page__components {
        flex-direction: column;
    }

    .fkp_updates-page__components-column {
        flex-basis: auto;
        width: 100%;
        min-width: 0;
    }
}

.fkp_updates-page__component {
    border: 2px var(--background-color-low, lightgray) solid;
    border-radius: 4px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    max-width: 100%;
}

.fkp_updates-page__component__header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
    border-bottom: 1px var(--background-color-low, lightgray) solid;
    padding-bottom: 8px;
    margin-bottom: 2px;
}

.fkp_updates-page__component__title {
    color: var(--text-color-high);
    font-size: 16px;
    font-weight: bold;
    line-height: 1.2;
    min-width: 0;
    overflow-wrap: anywhere;
}

.fkp_updates-page__component__header-version {
    color: var(--text-color-medium, #888);
    font-size: 13px;
    font-weight: normal;
    min-width: 0;
    overflow-wrap: anywhere;
}

.fkp_updates-page__component__details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.fkp_updates-page__component__info-row {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    flex-wrap: wrap;
    min-height: 24px;
    gap: 8px;
    min-width: 0;
    white-space: normal;
}

.fkp_updates-page__component__info-label {
    color: var(--text-color-medium, #888);
    font-size: 12px;
}

.fkp_updates-page__component__info-value {
    color: var(--text-color-high, #000);
    font-weight: 500;
    font-size: 13px;
    text-align: left;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow-wrap: anywhere;
}

.fkp_updates-page__component__info-value--latest {
    flex-wrap: wrap;
    justify-content: flex-start;
}

.fkp_updates-page__component__release-version-link {
    color: var(--link-color, #3498db) !important;
    text-decoration: underline;
    font-weight: bold;
    overflow-wrap: anywhere;
}

.fkp_updates-page__component__release-version-link:hover {
    color: var(--link-color-dark, #2980b9) !important;
}

.fkp_updates-page__component__actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: auto;
    min-width: 0;
}

.fkp_updates-page__component__actions--with-details {
    border-top: 1px var(--background-color-low, lightgray) solid;
    padding-top: 10px;
}

.fkp_updates-page__component__actions-main {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
}

.fkp_updates-page__component__variants {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
    min-width: 0;
}

.fkp_updates-page__component__variants-title {
    font-size: 11px;
    font-weight: bold;
    color: var(--text-color-medium, gray);
}

.fkp_updates-page__component__variants-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
}
`;
