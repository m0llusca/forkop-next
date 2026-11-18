// language=CSS
export const styles = `

.fkp-partial-modal__body {}

.fkp-partial-modal__body :is([role="status"], [role="alert"]):empty {
    display: none;
}

.fkp-partial-modal__content {
    max-height: min(70vh, calc(100dvh - 180px));
    max-width: 100%;
    overflow: auto;
    border-radius: 8px;
}

.fkp-partial-modal__footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.fkp-partial-modal__footer button {
    margin-left: 0;
    min-height: 42px;
    min-width: 42px;
}

.fkp-partial-modal__checkbox {
    display: inline-flex;
    align-items: center;
    min-height: 42px;
    gap: 8px;
    margin-right: auto;
    cursor: pointer;
    user-select: none;
}

.fkp-partial-modal__checkbox-text {
    line-height: 1.2;
}

@media (max-width: 560px) {
    .fkp-partial-modal__checkbox {
        flex-basis: 100%;
        margin-right: 0;
    }
}
`;
