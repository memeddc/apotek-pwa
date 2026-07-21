// src/lib/db/db.ts
import Dexie, { type Table } from 'dexie';
import type { Iobat, Ijenis_obat, Ipbf } from './types';

export class ApotekLocalDatabase extends Dexie {
    obat!: Table<Iobat>;
    jenis_obat!: Table<Ijenis_obat>;
    pbf!: Table<Ipbf>;

    constructor() {
        super('ApotekLocalDB');
        
        this.version(1).stores({
            obat: 'obat_id, obat_nama, jenis_id',
            jenis_obat: 'jenis_id, jenis_nama',
            pbf: 'pbf_id, pbf_nama'
        });
    }
}

export const localDB = new ApotekLocalDatabase();