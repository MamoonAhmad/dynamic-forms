import pg from 'pg';



export function escapeQueryValue(value: unknown): string | number {
    if (typeof value === 'string') {
        return pg.escapeLiteral(value);
    } else if (typeof value === 'number') {
        return value;
    } else if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    } else {
        const serialized = JSON.stringify(value);
        return pg.escapeLiteral(serialized);
    }
}

/**
 * Safely quote a SQL identifier (table or column name). Unlike a value,
 * an identifier cannot be parameterized, so it must be escaped. Column/table
 * names should ALSO be validated against the model before reaching here — this
 * is the last line of defense, not the first.
 */
export function escapeIdentifier(name: string): string {
    return pg.escapeIdentifier(name);
}
