interface CodeBlockProps {
    language?: string;
    code: string;
    title?: string;
}

export const CodeBlock = ({ language = "ts", code, title }: CodeBlockProps) => {
    return (
        <div className="rounded-xl border border-white/10 bg-card/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-background/40">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-bear/70" />
                    <span className="h-2 w-2 rounded-full bg-bull/40" />
                    <span className="h-2 w-2 rounded-full bg-primary/40" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground tracking-widest">
                    {title || language.toUpperCase()}
                </span>
            </div>
            <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-foreground/90">
                <code>{code}</code>
            </pre>
        </div>
    );
};