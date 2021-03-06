import { ParseTreeTraverser } from "intelephense/lib/parseTreeTraverser";
import { Phrase, Token, TokenType, PhraseType } from "php7parser";
import { Reference } from "intelephense/lib/reference";
import { ParsedDocument } from "intelephense/lib/parsedDocument";
import Log from "../Log";

export type Opt<T> = ([T] | (T[] & []));

export type Node = Phrase | Token;

export const opt = <T>(nullable: T | null): Opt<T> => nullable ? [nullable] : [];

const asTokenNode = (node: Node): Opt<Token> => {
    return 'tokenType' in node ? [node] : [];
};

const asPhraseNode = (node: Node): Opt<Phrase> => {
    return 'phraseType' in node ? [node] : [];
};

export const flattenTokens = (node: Node): Token[] => {
    if ('children' in node) {
        return node.children.flatMap(flattenTokens);
    } else {
        return [node];
    }
};

const getText = (node: Node, doc: ParsedDocument) => {
    const tokens = flattenTokens(node);
    const offset = tokens[0].offset;
    const length = tokens.reduce((sum, t) => sum + t.length, 0);

    return doc.text.slice(offset, offset + length);
};

const describeNode = (node: Node | null, doc: ParsedDocument): string => {
    if (!node) {
        return '(no node)';
    } else if ('phraseType' in node) {
        const subDescrs = node.children
            .map(subNode => describeNode(subNode, doc));
        const indented = subDescrs
            .join(',\n')
            .split('\n')
            .map(line => '    ' + line)
            .join('\n');
        return `${PhraseType[node.phraseType]}(\n${indented}\n)`;
    } else {
        const text = getText(node, doc).slice(0, 20).trim();
        return `${TokenType[node.tokenType]}(${text}) at ${node.offset}, ${node.length}`;
    }
};

/**
 * an immutable wrapper around Intelephense's traverser
 *
 * at some point could use linked lists tree for _spine instead of
 * copying it to make it nearly as fast as using traverser itself
 */
const Psi = <T extends Node>({traverser, node, doc}: {
    traverser: ParseTreeTraverser,
    node: T,
    doc: ParsedDocument,
}): Psi<T> => {
    const asPhrase = (...phraseTypes: PhraseType[]): Opt<Psi<Phrase>> => {
        const phraseOpt = asPhraseNode(node);
        if (!phraseOpt.length) {
            return [];
        }
        const phrase = phraseOpt[0];
        if (phraseTypes.length && !phraseTypes.includes(phrase.phraseType)) {
            return [];
        } else {
            return [Psi({traverser, node: phraseOpt[0], doc})];
        }
    };

    const nthChild = (n: number): Opt<Psi<Node>> => {
        const newTraverser = traverser.clone();
        newTraverser.nthChild(n);
        if (newTraverser.node) {
            return [Psi({
                traverser: newTraverser,
                node: newTraverser.node,
                doc,
            })];
        } else {
            return [];
        }
    };

    const parent = (): Opt<Psi<Phrase>> => {
        const newTraverser = traverser.clone();
        const parentNode = newTraverser.parent();
        if (parentNode &&
            'phraseType' in newTraverser.node
        ) {
            return [Psi({
                traverser: newTraverser,
                node: newTraverser.node,
                doc,
            })];
        } else {
            return [];
        }
    };

    return {
        node: node,
        doc: doc,
        asToken: (tokenType?) => {
            const tokenOpt = asTokenNode(node);
            if (!tokenOpt.length) {
                return [];
            }
            const token = tokenOpt[0];
            if (tokenType && tokenType !== token.tokenType) {
                return [];
            } else {
                return [Psi({traverser, node: tokenOpt[0], doc})];
            }
        },
        asPhrase: asPhrase,
        parent: parent,
        parents: () => {
            const parents = [];
            let parentOpt = parent();
            while (parentOpt.length) {
                parents.push(parentOpt[0]);
                parentOpt = parentOpt[0].parent();
            }
            return parents;
        },
        prevSibling: (pred?) => {
            pred = pred || (() => true);

            const newTraverser = traverser.clone();
            let prevPsi: IPsi;
            do {
                const prevNode = newTraverser.prevSibling();
                if (!prevNode) {
                    return [];
                }
                prevPsi = Psi({
                    traverser: newTraverser,
                    node: newTraverser.node,
                    doc,
                });
            } while (!pred(prevPsi));

            return [prevPsi];
        },
        nextSibling: (pred?) => {
            pred = pred || (() => true);

            const newTraverser = traverser.clone();
            let prevPsi: IPsi;
            do {
                const nextNode = newTraverser.nextSibling();
                if (!nextNode) {
                    return [];
                }
                prevPsi = Psi({
                    traverser: newTraverser,
                    node: newTraverser.node,
                    doc,
                });
            } while (!pred(prevPsi));

            return [prevPsi];
        },
        children: () => asPhrase()
            .flatMap(p => p.node.children)
            .flatMap((node, i) => nthChild(i)),
        nthChild: nthChild,
        reference: traverser.reference ? [traverser.reference] : [],
        toString() {
            return describeNode(node, doc);
        },
        eq: other => other.node === node,
        // possibly should replace '\r\n' with '\n' on windows here
        text: () => getText(node, doc),
    };
};

interface Psi<T extends Node> {
    node: T,
    doc: ParsedDocument,
    asToken: (tokenType?: TokenType) => Opt<Psi<Token>>,
    asPhrase: (...phraseTypes: PhraseType[]) => Opt<Psi<Phrase>>,
    parent: () => Opt<Psi<Phrase>>,
    parents: () => Psi<Phrase>[],
    /**
     * @param pred - if supplied, will take previous
     *  siblings till this predicate yields true
     */
    prevSibling: (pred?: (psi: IPsi) => boolean) => Opt<IPsi>,
    /**
     * @param pred - if supplied, will take next
     *  siblings till this predicate yields true
     */
    nextSibling: (pred?: (psi: IPsi) => boolean) => Opt<IPsi>,
    nthChild: (n: number) => Opt<Psi<Node>>,
    children: () => Psi<Node>[],
    reference: Opt<Reference>,
    toString: () => string,
    eq: (other: Psi<Node>) => boolean,
    text: () => string,
}

export type IPsi = Psi<Node>;

export default Psi;