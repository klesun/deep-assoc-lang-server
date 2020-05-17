import { Type, IStr, IInt } from "deep-assoc-lang-server/src/structures/Type";
import { IPsi } from "deep-assoc-lang-server/src/helpers/Psi";
import { IApiCtx } from "deep-assoc-lang-server/src/contexts/ApiCtx";
import { TokenType } from "php7parser";
import { unquote } from "deep-assoc-lang-server/src/helpers/Parsing";

/**
 * resolves explicit types, without reference resolution
 * could possibly consider passing different IApiCtx implementation
 * further that would tie to this one resolver instead of full one...
 */
const CheapTypeResolver = ({exprPsi}: {
    exprPsi: IPsi,
}): Type[] => {
    const main = () => {
        return [
            ...exprPsi.asToken(TokenType.StringLiteral)
                .flatMap(strLit => unquote(strLit.text()))
                .map(content => <IStr>({kind: 'IStr', content})),
            ...exprPsi.asToken(TokenType.IntegerLiteral)
                .map(intLit => <IInt>({kind: 'IInt', value: +intLit.text()})),
        ];
    };

    return main();
};

export default CheapTypeResolver;