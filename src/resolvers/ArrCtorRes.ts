import { IPsi, Opt } from "../helpers/Psi";
import { IApiCtx } from "../contexts/ApiCtx";
import { Type } from "../structures/Type";
import { PhraseType, TokenType } from "php7parser";
import { unquote } from "deep-assoc-lang-server/src/helpers/Parsing";

const ArrCtorRes = ({exprPsi, apiCtx}: {
    exprPsi: IPsi, apiCtx: IApiCtx,
}): Type[] => {
    const resolveAsArrCtor = (exprPsi: IPsi): Type[] =>
        exprPsi.asPhrase(PhraseType.ArrayCreationExpression)
            .flatMap(arrCtor => arrCtor.children())
            .flatMap(subPsi => subPsi.asPhrase(PhraseType.ArrayInitialiserList))
            .map(listPsi => {
                const keyNames = listPsi.children()
                    .flatMap(subPsi => subPsi.asPhrase(PhraseType.ArrayElement))
                    .flatMap(elPsi => elPsi.children())
                    .flatMap(subPsi => subPsi.asPhrase(PhraseType.ArrayKey))
                    .flatMap(keyPsi => keyPsi.children())
                    .flatMap(subPsi => subPsi.asToken(TokenType.StringLiteral))
                    .flatMap(strLit => unquote(strLit.text()));
                return {
                    kind: 'IRecordArr',
                    entries: keyNames.map(content => ({
                        keyType: {kind: 'IStr', content},
                        valueType: {kind: 'IAny'},
                    })),
                };
            });

    return resolveAsArrCtor(exprPsi);
};

export default ArrCtorRes;