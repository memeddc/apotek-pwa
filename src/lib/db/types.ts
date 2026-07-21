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
