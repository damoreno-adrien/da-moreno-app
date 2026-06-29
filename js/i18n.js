export let currentLang = localStorage.getItem('appLanguage') || 'en';

export const translations = {
    en: {
        management_dashboard: "Management Dashboard", dashboard_subtitle: "View orders and manage products.", catalog: "Catalog", logout: "Logout",
        order_processing: "Order Processing", pending_orders: "Pending Orders", loading_orders: "Loading orders...",
        final_supplier_list: "Final Supplier List", generate_list_subtitle: "Check the items, switch between branches, and mark them as Processed to trigger the delivery cycle.",
        generate_supplier_list: "Generate Supplier List", order_history: "Order History", loading_history: "Loading history...",
        product_management: "Product Management", add_new_product: "Add Product", image: "Image", product_name: "Product Name", reference: "Reference",
        supplier: "Supplier", status: "Status", actions: "Actions", loading_products: "Loading products...",
        staff_management: "Staff", add_staff_member: "Add Staff", name: "Name", department: "Department", loading_staff: "Loading staff...",
        department_management: "Departments", add_new_department: "Add Department", name_en: "Name (EN)", name_th: "Name (TH)", loading_departments: "Loading departments...",
        edit_product: "Edit Product", product_reference: "Product Reference", category_en: "Category (EN)", category_th: "Category (TH)",
        packaging_en: "Packaging (EN)", packaging_th: "Packaging (TH)", image_url: "Image URL", product_is_active: "Product is Active (Visible in catalog)",
        cancel: "Cancel", save_product: "Save Product", edit_staff_member: "Edit Staff Member", user_auth_uid: "User Auth UID",
        user_auth_uid_subtitle: "Create login in Firebase Auth first, then paste the UID here.", full_name: "Full Name", save_staff: "Save Staff",
        edit_department: "Edit Department", save_department: "Save Department", logged_in_as: "Logged in as:", date: "Date", user: "User",
        all_suppliers: "All Suppliers", keywords: "Search Keywords", supplier_management: "Suppliers", add_new_supplier: "Add Supplier",
        save_supplier: "Save Supplier", my_orders: "My Orders", create_order: "Create Order", edit_order: "Edit Order", update_order: "Update Order",
        import_csv: "Import", export_csv: "Export", branch_management: "Branches", add_new_branch: "Add Branch", branch: "Branch",
        select_branch: "Select a branch", role: "Role", admin_branch_context: "Active Branch:", all_branches: "All Branches",
        edit_branch: "Edit Branch", save_branch: "Save Branch", filter_by_status: "Filter by status:",
        all: "All", pending: "Pending", processed: "Processed", cancelled: "Cancelled", loading_my_orders: "Loading my orders...", reorder: "Reorder",
        start_date: "Start Date", end_date: "End Date", clear_dates: "Clear", delete_selected: "Delete Selected", delete_permanently: "Delete",
        inject_manual: "Inject Item (Manual)", select_staff: "Select Staff", target_department: "Target Department", search_product: "Search product...", quantity: "Qty", add_line: "Add Line", replace: "Replace",
        company_info: "Company Info", contact_person: "Contact Person", same_as_company: "Same as Company",
        address: "Address", phone_number: "Phone Number", line_id: "LINE ID", preferred_channel: "Preferred Channel",
        payment_terms: "Payment Terms", other_precise: "Other (precise)", supplier_details: "Supplier Details", 
        products_supplied: "Products Supplied", back_to_suppliers: "Back to Suppliers", email_address: "Email Address",
        bank_details: "Bank Details", bank_name: "Bank Name", account_number: "Account Number", account_name: "Account Name", select_bank: "Select Bank...", other_bank: "Other Bank",
        
        assign_branches: "Assign Branches", extra_permissions: "Extra Permissions",
        can_receive_orders: "Can Receive Orders", can_manage_payments: "Can Manage Payments",
        commercial_name: "Commercial Name", legal_company_name: "Legal Company Name",
        mark_tab_processed: "Mark Checked Items in THIS Tab as Processed", copy_displayed_branch: "Copy Displayed Branch",
        status_received: "Received", status_paid: "Paid", accounting: "Accounting", receiving: "Receiving", admin_dashboard: "Admin",
        
        awaiting_payments: "Awaiting Payments", pay_order: "Settle Payment", invoice_amount: "Invoice Amount",
        due_date: "Due Date", mark_as_paid: "Confirm Payment", transaction_ref: "Transaction / Transfer Ref", payment_date: "Payment Date",
        
        can_process_orders: "Can Process Orders (Admin Panel)",
        consolidated: "Purchase Order", alert_select_item: "Please select at least one item.",
        confirm_process_tab: "Process ONLY checked items in THIS tab? (Unchecked items will remain Pending)",
        alert_no_branch: "No active branch selected.", nothing_to_copy: "Nothing checked to copy.",
        reassign_order: "Reassign Order", rollback: "Rollback to Pending", confirm_rollback: "Are you sure you want to cancel this Purchase Order? All linked staff requests will revert to Pending.",
        back_to_pending: "Back to Pending", list_generated: "List generated successfully!", copied: "Copied!"
    },
    th: {
        management_dashboard: "แดชบอร์ดการจัดการ", dashboard_subtitle: "ดูคำสั่งซื้อและจัดการสินค้า", catalog: "แคตตาล็อก", logout: "ออกจากระบบ",
        order_processing: "การประมวลผลคำสั่งซื้อ", pending_orders: "คำสั่งซื้อที่รอดำเนินการ", loading_orders: "กำลังโหลดคำสั่งซื้อ...",
        final_supplier_list: "รายชื่อซัพพลายเออร์สุดท้าย", generate_list_subtitle: "ตรวจสอบรายการ สลับระหว่างสาขา และทำเครื่องหมายว่าดำเนินการแล้วเพื่อเริ่มรอบการจัดส่ง",
        generate_supplier_list: "สร้างรายชื่อซัพพลายเออร์", order_history: "ประวัติคำสั่งซื้อ", loading_history: "กำลังโหลดประวัติ...",
        product_management: "การจัดการสินค้า", add_new_product: "เพิ่มสินค้า", image: "รูปภาพ", product_name: "ชื่อสินค้า", reference: "อ้างอิง",
        supplier: "ซัพพลายเออร์", status: "สถานะ", actions: "การดำเนินการ", loading_products: "กำลังโหลดสินค้า...",
        staff_management: "พนักงาน", add_staff_member: "เพิ่มพนักงาน", name: "ชื่อ", department: "แผนก", loading_staff: "กำลังโหลดพนักงาน...",
        department_management: "แผนก", add_new_department: "เพิ่มแผนก", name_en: "ชื่อ (อังกฤษ)", name_th: "ชื่อ (ไทย)", loading_departments: "กำลังโหลดแผนก...",
        edit_product: "แก้ไขสินค้า", product_reference: "การอ้างอิงสินค้า", category_en: "หมวดหมู่ (อังกฤษ)", category_th: "หมวดหมู่ (ไทย)",
        packaging_en: "บรรจุภัณฑ์ (อังกฤษ)", packaging_th: "บรรจุภัณฑ์ (ไทย)", image_url: "URL รูปภาพ", product_is_active: "สินค้าใช้งานอยู่ (แสดงในแคตตาล็อก)",
        cancel: "ยกเลิก", save_product: "บันทึกสินค้า", edit_staff_member: "แก้ไขพนักงาน", user_auth_uid: "UID การยืนยันตัวตนผู้ใช้",
        user_auth_uid_subtitle: "สร้างการเข้าสู่ระบบ in Firebase Auth ก่อน แล้ววาง UID ที่นี่", full_name: "ชื่อเต็ม", save_staff: "บันทึกพนักงาน",
        edit_department: "แก้ไขแผนก", save_department: "บันทึกแผนก", logged_in_as: "เข้าสู่ระบบในชื่อ:", date: "วันที่", user: "ผู้ใช้",
        all_suppliers: "ซัพพลายเออร์ทั้งหมด", keywords: "คำค้นหา", supplier_management: "ซัพพลายเออร์", add_new_supplier: "เพิ่มซัพพลายเออร์",
        save_supplier: "บันทึกซัพพลายเออร์", my_orders: "คำสั่งซื้อของฉัน", create_order: "สร้างคำสั่งซื้อ", edit_order: "แก้ไขคำสั่งซื้อ", update_order: "อัปเดตคำสั่งซื้อ",
        import_csv: "นำเข้า", export_csv: "ส่งออก", branch_management: "สาขา", add_new_branch: "เพิ่มสาขา", branch: "สาขา",
        select_branch: "เลือกสาขา", role: "บทบาท", admin_branch_context: "สาขาที่เปิดอยู่:", all_branches: "ทุกสาขา",
        edit_branch: "แก้ไขสาขา", save_branch: "บันทึกสาขา", filter_by_status: "กรองตามสถานะ:",
        all: "ทั้งหมด", pending: "รอดำเนินการ", processed: "ดำเนินการแล้ว", cancelled: "ยกเลิกแล้ว", loading_my_orders: "กำลังโหลดคำสั่งซื้อของฉัน...", reorder: "สั่งอีกครั้ง",
        start_date: "วันที่เริ่มต้น", end_date: "วันที่สิ้นสุด", clear_dates: "ล้าง", delete_selected: "ลบที่เลือก", delete_permanently: "ลบ",
        inject_manual: "เพิ่มรายการ (กำหนดเอง)", select_staff: "เลือกพนักงาน", target_department: "แผนกเป้าหมาย", search_product: "ค้นหาสินค้า...", quantity: "จำนวน", add_line: "เพิ่มรายการ", replace: "แทนที่",
        company_info: "ข้อมูลบริษัท", contact_person: "ผู้ติดต่อ", same_as_company: "เหมือนกับบริษัท",
        address: "ที่อยู่", phone_number: "เบอร์โทรศัพท์", line_id: "LINE ID", preferred_channel: "ช่องทางที่สะดวก",
        payment_terms: "เงื่อนไขการชำระเงิน", other_precise: "อื่นๆ (โปรดระบุ)", supplier_details: "รายละเอียดซัพพลายเออร์", 
        products_supplied: "สินค้าที่จัดหา", back_to_suppliers: "กลับไปหน้ารายชื่อซัพพลายเออร์", email_address: "ที่อยู่อีเมล",
        bank_details: "รายละเอียดบัญชีธนาคาร", bank_name: "ชื่อธนาคาร", account_number: "หมายเลขบัญชี", account_name: "ชื่อบัญชี", select_bank: "เลือกธนาคาร...", other_bank: "ธนาคารอื่นๆ",
        
        assign_branches: "กำหนดสาขา", extra_permissions: "สิทธิ์เพิ่มเติม",
        can_receive_orders: "สามารถรับสินค้าได้", can_manage_payments: "สามารถจัดการการชำระเงินได้",
        commercial_name: "ชื่อทางการค้า", legal_company_name: "ชื่อบริษัทจดทะเบียน",
        mark_tab_processed: "ทำเครื่องหมายรายการที่เลือกในแท็บนี้ว่าดำเนินการแล้ว", copy_displayed_branch: "คัดลอกสาขาที่แสดง",
        status_received: "รับสินค้าแล้ว", status_paid: "ชำระเงินแล้ว", accounting: "บัญชี", receiving: "รับสินค้า", admin_dashboard: "ผู้ดูแลระบบ",
        
        awaiting_payments: "รอการชำระเงิน", pay_order: "ชำระเงิน", invoice_amount: "ยอดบิล",
        due_date: "วันครบกำหนด", mark_as_paid: "ยืนยันการชำระเงิน", transaction_ref: "เลขอ้างอิงการโอน", payment_date: "วันที่ชำระเงิน",
        
        can_process_orders: "สามารถจัดการคำสั่งซื้อได้ (แผงควบคุม)",
        consolidated: "ใบสั่งซื้อ", alert_select_item: "กรุณาเลือกอย่างน้อยหนึ่งรายการ",
        confirm_process_tab: "ดำเนินการเฉพาะรายการที่เลือกในแท็บนี้หรือไม่? (รายการที่ไม่ได้เลือกจะยังคงรอดำเนินการ)",
        alert_no_branch: "ไม่ได้เลือกสาขา", nothing_to_copy: "ไม่มีรายการที่เลือกสำหรับคัดลอก",
        reassign_order: "โอนคำสั่งซื้อ", rollback: "ย้อนกลับเป็นรอดำเนินการ", confirm_rollback: "คุณแน่ใจหรือไม่ว่าต้องการยกเลิกใบสั่งซื้อนี้? คำขอของพนักงานที่เชื่อมโยงทั้งหมดจะกลับสู่สถานะรอดำเนินการ",
        
        back_to_pending: "กลับไปรอดำเนินการ", list_generated: "สร้างรายการสำเร็จแล้ว!", copied: "คัดลอกแล้ว!"
    }
};

export function setLanguage(lang, renderCallback = null) {
    currentLang = lang;
    localStorage.setItem('appLanguage', lang);
    document.querySelectorAll('[data-key]').forEach(el => {
        const key = el.dataset.key;
        if (translations[lang] && translations[lang][key]) el.textContent = translations[lang][key];
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.dataset.lang === lang) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    if (renderCallback) renderCallback();
}

export function setupLangSwitcher(renderCallback = null) {
    const switcher = document.getElementById('lang-switcher');
    if (switcher) {
        switcher.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            if (lang) setLanguage(lang, renderCallback);
        });
    }
}