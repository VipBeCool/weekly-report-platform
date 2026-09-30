import { NextRequest, NextResponse } from 'next/server';
import { getMembers, addMember, saveMembers, deleteMember } from '@/lib/db';

// 获取所有成员
export async function GET() {
  const members = await getMembers();
  return NextResponse.json(members);
}

// 创建新成员
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: '姓名不能为空' }, { status: 400 });
  }

  const members = await getMembers();

  // 检查重复姓名，若已存在则直接返回
  const existing = members.find((m) => m.name === name.trim());
  if (existing) {
    return NextResponse.json(existing);
  }

  const newMember = {
    id: crypto.randomUUID(),
    name: name.trim(),
    created_at: new Date().toISOString(),
  };

  await addMember(newMember);
  return NextResponse.json(newMember, { status: 201 });
}

// 批量更新成员列表（支持更新顺序、编辑姓名）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { members } = body;

    if (!Array.isArray(members)) {
      return NextResponse.json({ error: '参数必须为成员数组' }, { status: 400 });
    }

    // 校验每个成员必须有 id 和 name
    const validMembers = members
      .filter((m) => m && typeof m.name === 'string' && m.name.trim())
      .map((m) => ({
        id: m.id || crypto.randomUUID(),
        name: m.name.trim(),
        created_at: m.created_at || new Date().toISOString(),
      }));

    await saveMembers(validMembers);
    return NextResponse.json({ success: true, members: validMembers });
  } catch (error) {
    console.error('更新成员失败:', error);
    return NextResponse.json({ error: '更新成员失败' }, { status: 500 });
  }
}

// 删除指定成员
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
    }

    const members = await getMembers();
    const exists = members.some((m) => m.id === id);

    if (!exists) {
      return NextResponse.json({ error: '未找到指定成员' }, { status: 404 });
    }

    await deleteMember(id);
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除成员失败:', error);
    return NextResponse.json({ error: '删除成员失败' }, { status: 500 });
  }
}
