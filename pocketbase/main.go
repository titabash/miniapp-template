// main.go
// PocketBase v0.29.x – 既定の CORS ミドルウェアを解除し、
// JSVM + migratecmd プラグインを登録する最小構成。
package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

func main() {
	// PocketBase アプリ インスタンスを生成
	app := pocketbase.New()

	//--------------------------------------------------------------------
	// 1) 既定 CORS ミドルウェアを解除（カスタム化したい場合）
	//--------------------------------------------------------------------
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// apis.DefaultCorsMiddlewareId は v0.29 現行定数名
		se.Router.Unbind(apis.DefaultCorsMiddlewareId)
		return se.Next()
	})

	//--------------------------------------------------------------------
	// 2) JSVM プラグイン登録
	//    第 2 引数に jsvm.Config が必須（v0.23+）
	//--------------------------------------------------------------------
	// isDev := strings.HasPrefix(os.Args[0], os.TempDir()) // go run 時は一時パスに置かれる
	isDev := true
	jsvm.MustRegister(app, jsvm.Config{
		// pb_hooks / pb_migrations はデフォルトパスを利用
		HooksWatch: isDev, // 開発時のみホットリロード
	})

	//--------------------------------------------------------------------
	// 3) migratecmd プラグイン登録
	//--------------------------------------------------------------------
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate:  true,                       // serve 起動時に未適用マイグレーションを自動実行
		TemplateLang: migratecmd.TemplateLangJS,  // JS テンプレートを利用
		// MigrationsDir: "pb_migrations",        // 変更したい場合は明示
	})

	//--------------------------------------------------------------------
	// 4) サーバ起動
	//--------------------------------------------------------------------
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
