import { IPsi } from "../helpers/Psi";
import { Type, IStr, IInt } from "../structures/Type";
import { IApiCtx } from "../contexts/ApiCtx";
import VarRes from "./VarRes";
import FuncCallRes from "./FuncCallRes";
import ArrCtorRes from "./ArrCtorRes";
import Log from "deep-assoc-lang-server/src/Log";
import { PhraseType, TokenType } from "php7parser";
import { getKeyByPsi } from "deep-assoc-lang-server/src/helpers/Typing";
import CheapTypeResolver from "deep-assoc-lang-server/src/resolvers/CheapTypeResolver";

const DirectTypeResolver = ({exprPsi, apiCtx}: {
    exprPsi: IPsi, apiCtx: IApiCtx,
}): Type[] => {

    const resolveAsAssocGet = ({exprPsi}: {exprPsi: IPsi}): Type[] => {
        return exprPsi.asPhrase(PhraseType.SubscriptExpression)
            .flatMap(psi => psi.nthChild(0))
            .flatMap(arrExpr => arrExpr
                .nextSibling(sib => sib.asToken(TokenType.OpenBracket).length > 0)
                .flatMap(bra => bra.nextSibling())
                .flatMap(keyExpr => {
                    const arrExprTypes = apiCtx.resolveExpr(arrExpr);
                    const elTypes = arrExprTypes.flatMap(arrt => getKeyByPsi(arrt, keyExpr));
                    return elTypes;
                }));
    };

    const main = () => {
        const result: Type[] = [
            ...ArrCtorRes({exprPsi, apiCtx}),
            ...FuncCallRes({exprPsi, apiCtx}),
            ...VarRes({exprPsi, apiCtx}),
            ...resolveAsAssocGet({exprPsi}),
            ...CheapTypeResolver({exprPsi}),
        ];
        if (!result.length) {
            //Log.info({'ololo no results for': exprPsi + ''});
        }
        return result;
    };

    return main();
};

export default DirectTypeResolver;