Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL12.SQL\MSSQLServer\SuperSocketNetLib\Tcp" -Name Enabled -Value 1
Restart-Service -Name "MSSQL`$SQL" -Force


