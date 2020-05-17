import { IPsi, Opt } from "../helpers/Psi";
import { IApiCtx } from "../contexts/ApiCtx";
import { Type, ITupleArr, IRecordArr, IRecordEntry } from "../structures/Type";
import { PhraseType, TokenType } from "php7parser";
import Log from "deep-assoc-lang-server/src/Log";
import CheapTypeResolver from "deep-assoc-lang-server/src/resolvers/CheapTypeResolver";

const ArrCtorRes = ({exprPsi, apiCtx}: {
    exprPsi: IPsi, apiCtx: IApiCtx,
}): Type[] => {
    const asAssoc = (elementPsis: IPsi[]): Opt<IRecordArr> => {
        const entries: IRecordEntry[] = elementPsis
            .flatMap(elPsi => {
                const entryPsis = elPsi.children();
                const valueType = entryPsis
                    .flatMap(subPsi => subPsi.asPhrase(PhraseType.ArrayValue))
                    .flatMap(keyPsi => keyPsi.children())
                    .flatMap(apiCtx.resolveExpr)
                    [0] || {kind: 'IAny'};
                return entryPsis
                    .flatMap(subPsi => subPsi.asPhrase(PhraseType.ArrayKey))
                    .flatMap(keyPsi => keyPsi.children())
                    .flatMap(exprPsi => CheapTypeResolver({exprPsi}))
                    .map(keyType => ({keyType, valueType}));
            });
        return entries.length === 0 ? [] : [{
            kind: 'IRecordArr',
            entries,
        }];
    };

    const asTuple = (elementPsis: IPsi[]): Opt<ITupleArr> => {
        const tupleTypes = elementPsis
            .flatMap(elPsi => {
                const children = elPsi.children();
                return children.length !== 1 ? [] :
                    children[0].asPhrase(PhraseType.ArrayValue)
            })
            .flatMap(keyPsi => keyPsi.children())
            .flatMap(apiCtx.resolveExpr);
        return tupleTypes.length === 0 ? [] : [{
            kind: 'ITupleArr',
            elements: tupleTypes,
        }];
    };

    const resolveAsArrCtor = (exprPsi: IPsi): Type[] =>
        exprPsi.asPhrase(PhraseType.ArrayCreationExpression)
            .flatMap(arrCtor => arrCtor.children())
            .flatMap(subPsi => subPsi.asPhrase(PhraseType.ArrayInitialiserList))
            .flatMap(listPsi => {
                const elementPsis = listPsi.children()
                    .flatMap(subPsi => subPsi.asPhrase(PhraseType.ArrayElement));
                return [
                    ...asAssoc(elementPsis),
                    ...asTuple(elementPsis),
                ];
            })
            .filter(arrt => Log.info({'arrt': arrt}));

    return resolveAsArrCtor(exprPsi);
};

export default ArrCtorRes;