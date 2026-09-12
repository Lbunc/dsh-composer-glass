# dsh-composer-glass

把 DSH 的输入框变成**一整块均匀半透明的毛玻璃面板**，开关在设置 → 通用。

![开始会话](images/01-start-session.png)

![会话效果](images/02-in-conversation.png)

## 设置开关

![设置页面](images/03-settings.png)

## 安装

```sh
dsh plugin --profile web add dsh-composer-glass
```

装完重启 DSH，在**设置 → 通用**里打开。

## 升级

```sh
dsh plugin --profile web add dsh-composer-glass@latest
```

## 卸载

```sh
dsh plugin --profile web remove dsh-composer-glass
```

> Windows 上如果手动删残留目录，删掉 `node_modules\dsh-composer-glass` 即可。

---

## 说明

开关状态刷新页面后会重置 —— 持久化需要 Host 侧 settings 命名空间，留作后续改动。

这个插件是**材质**，不是折射。输入框背后是平坦纯色，折射它不会有任何可见变化，
原因与实测记录见 [docs/WHY-NOT-REFRACTION.md](docs/WHY-NOT-REFRACTION.md)。

开发与发布见 [docs/RELEASING.md](docs/RELEASING.md)。英文说明见
[README.en.md](README.en.md)。

## 许可

MIT
