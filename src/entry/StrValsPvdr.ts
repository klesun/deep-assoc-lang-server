import { CompletionItem } from "vscode-languageserver";
import { IApiCtx } from "deep-assoc-lang-server/src/contexts/ApiCtx";
import { IPsi } from "deep-assoc-lang-server/src/helpers/Psi";
import Log from "deep-assoc-lang-server/src/Log";
import { TokenType, PhraseType } from "php7parser";
import * as lsp from 'vscode-languageserver-types';

/**
 *                                              \/
 * provides completion options in `$someVar === ''`
 */
const StrValsPvdr = (params: {
    apiCtx: IApiCtx, psi: IPsi,
}): CompletionItem[] => {
    const {apiCtx} = params;

    const getCompletions = (psi: IPsi): CompletionItem[] => {
        return psi.asToken(TokenType.StringLiteral)
            .flatMap(lit => lit.parent())
            .filter(par => par.node.phraseType === PhraseType.EqualityExpression)
            .flatMap(par => par.children())
            .flatMap(operand => operand.asPhrase())
            .filter(operand => !operand.eq(psi))
            .flatMap(apiCtx.resolveExpr)
            .flatMap(type => type.kind !== 'IStr' ? [] : [type.content])
            .map((label, i) => ({
                label: label,
                sortText: (i + '').padStart(7, '0'),
                detail: 'deep-assoc FTW',
                kind: lsp.CompletionItemKind.Value,
            }));
    };

    return getCompletions(params.psi);
};

export default StrValsPvdr;