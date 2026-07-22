export interface Iobat {
    obat_id: string; // Primary Key
    obat_nama: string;
    jenis_id: string;
    ket_obat?: string;
    isActive: 0 | 1;
}

export interface Ijenis_obat {
    jenis_id: string; // Primary Key
    jenis_nama: string;
}

export interface Ipbf {
    pbf_id: string; // Primary Key
    pbf_nama: string;
    no_telp?: string;
    alamat?: string;
}

export interface Ipenjualan {
    trans_id: string; // Primary Key
    tanggal_waktu: string; // Format: "YYYY-MM-DD HH:mm:ss"
    total_trans: number; 
    total_disc: number; 
    bayar: number; 
    kembali: number; 
}

export interface Idetail_penjualan {
    trans_id: string; 
    obat_id: string;  
    qty: number;      
    harga_obat: number; 
}

export interface Ipembelian {
    trans_id: string; // Primary Key
    pbf_id: string; 
    total_trans: number; 
    total_disc: number;
    tanggal_waktu?: string; // Format: "YYYY-MM-DD HH:mm:ss"
}

export interface Idetail_purchase {
    trans_id: string; 
    obat_id: string;  
    qty: number;      
    total_per_obat: number; 
    disc: number;     
}

export interface Istok {
    obat_id: string;  
    qty: number; 
    expired_date: string; // Format: "YYYY-MM-DD"
    harga_pbf: number; 
    harga_jual: number;
    diberikan: 0 | 1;
}

export interface Ikartu_stok {
    obat_id: string;  
    qty: number; 
    trans_id: string;  
    tanggal_waktu: string; // Format: "YYYY-MM-DD HH:mm:ss"
}

export interface IFakturItemInput {
    obat_id: string;
    jumlah_box: number;
    isi_per_box: number;
    harga_per_box: number;
    disc: number;
    expired_date: string;
    diberikan: 0 | 1;
}

export interface IFakturSimpanInput {
    trans_id: string;
    pbf_id: string;
    tanggal_waktu: string;
    total_trans: number;
    total_disc: number;
    details: IFakturItemInput[];
}

export interface Iresep {
    id?: string;
    resep_id: string; // Primary Key (e.g. RSP-20260722-001)
    pasien_nama: string;
    dokter_nama: string;
    alamat_pasien: string;
    tanggal_resep: string; // Format: YYYY-MM-DD
    tanggal_buat?: string; // Format: YYYY-MM-DD HH:mm:ss
    ket_resep?: string | null;
}

export interface Idetail_resep {
    resep_id: string;
    obat_id: string;
    qty_resep: number;
    qty_asli: number;
    harga_per_obat: number;
}

export interface Idetail_racikan {
    resep_id: string;
    obat_id: string;
    qty_racikan: number;
}

export interface IResepItemInput {
    obat_id: string;
    obat_nama?: string;
    qty_resep: number;
    qty_asli: number;
    harga_per_obat: number;
}

export interface IResepRacikanInput {
    obat_id: string;
    obat_nama?: string;
    qty_racikan: number;
}

export interface IResepSimpanInput {
    resep_id: string;
    pasien_nama: string;
    dokter_nama: string;
    alamat_pasien: string;
    tanggal_resep: string;
    ket_resep?: string;
    details: IResepItemInput[];
    racikan: IResepRacikanInput[];
}

