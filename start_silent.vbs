Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' 1. 强力清理残留的旧 node 进程，防止 3000 端口冲突静默失败
WshShell.Run "cmd /c taskkill /F /T /IM node.exe >nul 2>nul", 0, True
WScript.Sleep 1000

' 2. 若无编译构建产物，则执行构建
If Not fso.FolderExists(scriptDir & "\.next") Then
    WshShell.Run "cmd /c npm run build", 0, True
End If

' 3. 后台静默启动生产服务
WshShell.Run "cmd /c npm run start", 0, False
