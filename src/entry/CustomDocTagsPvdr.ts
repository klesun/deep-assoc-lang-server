import { IApiCtx } from "deep-assoc-lang-server/src/contexts/ApiCtx";
import { IPsi } from "deep-assoc-lang-server/src/helpers/Psi";
import { CompletionItem } from "vscode-languageserver";
import Log from "deep-assoc-lang-server/src/Log";
import { TokenType } from "php7parser";
import * as lsp from 'vscode-languageserver-types';

/**
 * provides completion of non-standard phpdoc tags, like @psalm-type and @psalm-import-type
 * \/ suggests completion here
 * @
 */
const CustomDocTagsPvdr = (params: {
    apiCtx: IApiCtx, psi: IPsi, position: lsp.Position,
}): CompletionItem[] => {
    const getCompletions = (psi: IPsi): CompletionItem[] => {
        const caretOffset = psi.doc.offsetAtPosition(params.position);
        if (psi.asToken(TokenType.DocumentComment) &&
            psi.doc.text.slice(caretOffset - 1, caretOffset) === '@'
        ) {
            return ['psalm-type', 'psalm-import-type'].map((label, i) => ({
                label: label,
                kind: lsp.CompletionItemKind.Keyword,
                detail: 'deep-assoc FTW',
                sortText: (i + '').padStart(7, '0'),
            }));
        } else {
            return [];
        }
    };

    return getCompletions(params.psi);
};

export default CustomDocTagsPvdr;