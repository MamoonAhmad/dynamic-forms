import pg from 'pg';



export function escapeQueryValue(value) {
    if (typeof value === 'string') {
        return pg.escapeLiteral(value);
    } else if (typeof value === 'number') {
        return value;
    } else if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    } else {
        value = JSON.stringify(value);
        return pg.escapeLiteral(value);
    }
}