export interface IMasterObat {
    obat_id: string; // Primary Key
    obat_nama: string;
    jenis_id: string;
    ket_obat?: string;
}

export interface IMasterJenisObat {
    jenis_id: string; // Primary Key
    jenis_nama: string;
}

export interface IMasterPBF {
    pbf_id: string; // Primary Key
    pbf_nama: string;
    no_telp?: string;
    alamat?: string;
}