// src/lib/db/db.ts
import Dexie, { type Table } from 'dexie';
import type { IMasterObat, IMasterJenisObat, IMasterPBF } from './types';

export class ApotekLocalDatabase extends Dexie {
    masterobat!: Table<IMasterObat>;
    masterjenisobat!: Table<IMasterJenisObat>;
    masterpbf!: Table<IMasterPBF>;

    constructor() {
        super('ApotekLocalDB');
        
        this.version(1).stores({
            masterobat: 'obat_id, obat_nama, jenis_id',
            masterjenisobat: 'jenis_id, jenis_nama',
            masterpbf: 'pbf_id, pbf_nama'
        });
    }
}

export const localDB = new ApotekLocalDatabase();