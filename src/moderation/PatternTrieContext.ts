export class TrieNode {
    public children: Map<string, TrieNode> = new Map();
    public failLink: TrieNode | null = null;
    public char: string | null = null; // Character that leads to this node
    public outputs: Array<{ 
        term: string; 
        offset: number; 
        length: number;
        maxEditDistance: number;
    }> = [];
}

export class PatternTrieContext {
    private root: TrieNode = new TrieNode();

    constructor() {}

    /**
     * Adds banned term to the Trie.
     * 
     * Banned term is partitioned into (maxEditDistance + 1) segments to enable the pigeon-hole principle for fuzzy matching.
     * 
     * @param term banned term to add to the trie.
     * @param maxEditDistance maximum allowable character deviation from the banned term so that it is still considered as a match.
     */
    public addPattern(term: string, maxEditDistance: number): void {
        const numPartitions = maxEditDistance + 1;
        const partitionSize = Math.floor(term.length / numPartitions);

        // Standard partitioning for fuzzy matching
        for (let i = 0; i < numPartitions; i++) {
            const start = i * partitionSize;
            const end = (i === numPartitions - 1) ? term.length : (i + 1) * partitionSize;
            const partitionText = term.slice(start, end);
            
            if (partitionText.length > 0) {
                this.insert(term, start, partitionText.toLowerCase(), maxEditDistance);
            }
        }

        if (maxEditDistance > 0) {
            this.insert(term, 0, term.toLowerCase(), maxEditDistance);
        }
    }

    /**
     * Inserts the partitioned banned term into the trie.
     * 
     * @param term original banned term.
     * @param offset starting index of the partitioned segment in the original banned term.
     * @param partitionText actual partitioned banned term to be added to the trie.
     * @param maxEditDistance maximum allowable character deviation from the banned term so that it is still considered as a match.
     */
    private insert(term: string, offset: number, partitionText: string, maxEditDistance: number): void {
        let node = this.root;
        for (const char of partitionText) {
            if (!node.children.has(char)) {
                const newNode = new TrieNode();
                newNode.char = char;
                node.children.set(char, newNode);
            }
            node = node.children.get(char)!;
        }
        // store metadata of the partitioned term at the terminal node.
        node.outputs.push({
            term,
            offset,
            length: partitionText.length,
            maxEditDistance
        });
    }

    public buildFailureLinks(): void {
        const queue: TrieNode[] = [];

        for (const child of this.root.children.values()) {
            child.failLink = this.root;
            queue.push(child);
        }

        while (queue.length > 0) {
            const current = queue.shift()!;

            for (const [char, child] of current.children.entries()) {
                let fail = current.failLink;

                while (fail !== null && !fail.children.has(char)) {
                    fail = fail.failLink;
                }

                child.failLink = fail ? fail.children.get(char)! : this.root;
                
                if (child.failLink.outputs.length > 0) {
                    child.outputs.push(...child.failLink.outputs);
                }

                queue.push(child);
            }
        }
    }

    public search(message: string): Map<string, Set<{physicalEnd: number, isExact: boolean, len: number}>> {
        let node: TrieNode = this.root;
        const results = new Map<string, Set<{physicalEnd: number, isExact: boolean, len: number}>>();

        for (let i = 0; i < message.length; i++) {
            const charStr = message[i].toLowerCase();
            const isDelimiter = charStr < 'a' || charStr > 'z';
            const isAlphaNumeric = /^[a-z0-9]+$/i.test(charStr);

            if (!isAlphaNumeric) {
                continue;
            }

            if (!node.children.has(charStr)) {
                if (node !== this.root && charStr === node.char) {
                    continue; 
                }

                if (node !== this.root && isDelimiter) {
                    continue; 
                }
            }

            let nextNode: TrieNode | null = node;
            while (nextNode !== null && !nextNode.children.has(charStr)) {
                nextNode = nextNode.failLink;
            }

            const transitionedNode = nextNode ? nextNode.children.get(charStr)! : this.root;
            
            if (transitionedNode !== node && transitionedNode.outputs.length > 0) {
                this.recordMatch(results, transitionedNode, i);
            }
            
            node = transitionedNode;
        }

        return results;
    }

    private recordMatch(
        results: Map<string, Set<{physicalEnd: number, isExact: boolean, len: number}>>, 
        node: TrieNode, 
        currentIdx: number
    ): void {
        for (const output of node.outputs) {
            if (!results.has(output.term)) {
                results.set(output.term, new Set());
            }

            const isExact = output.length === output.term.length;
            results.get(output.term)!.add({ physicalEnd: currentIdx, isExact, len: output.length });
        }
    }
}
