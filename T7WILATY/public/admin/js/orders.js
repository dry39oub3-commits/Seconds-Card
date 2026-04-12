window.approveOrder = async (orderId) => {
    const code = document.getElementById('modal-code').value.trim();
    const cost = document.getElementById('modal-cost').value.trim();
    const supplierId = document.getElementById('modal-supplier-id').value.trim();

    // ✅ التحقق من جميع الحقول الإلزامية
    if (!code) {
        alert('⚠️ يرجى إدخال كود البطاقة!');
        document.getElementById('modal-code').focus();
        return;
    }
    if (!cost || parseFloat(cost) <= 0) {
        alert('⚠️ يرجى إدخال سعر التكلفة!');
        document.getElementById('modal-cost').focus();
        return;
    }
    if (!supplierId) {
        alert('⚠️ يرجى إدخال أو اختيار معرف المورد!');
        document.getElementById('modal-supplier-id').focus();
        return;
    }

    // التحقق من عدم تكرار الكود في جدول used_codes
    const { data: existingCode } = await supabase
        .from('used_codes')
        .select('id')
        .eq('code', code)
        .maybeSingle();

    if (existingCode) {
        alert('⚠️ هذا الكود مستخدم بالفعل ومسجل كمباع!');
        return;
    }

    // تحديث الطلب
    const { data: orderData, error } = await supabase
        .from('orders')
        .update({
            status: 'مكتمل',
            card_code: code,
            cost_price: parseFloat(cost) || 0,
            supplier_id: supplierId
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        alert('خطأ: ' + error.message);
        return;
    }

    // تسجيل الكود في جدول used_codes
    const { error: codeError } = await supabase
        .from('used_codes')
        .insert({
            code: code,
            order_id: orderId,
            product_name: orderData.product_name
        });

    if (codeError) {
        console.error('خطأ في تسجيل الكود:', codeError);
    }

    document.getElementById('order-modal').remove();
    alert('✅ تم قبول الطلب وتسجيل الكود بنجاح!');
    loadOrders();
};