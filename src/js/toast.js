      // ============================================================
      // Toast System — with queue to prevent overlap
      // ============================================================
      var toastQueue = [];
      var toastActive = 0;
      var TOAST_MAX_VISIBLE = 3;
      var TOAST_GAP_MS = 150; // stagger delay between toasts

      function showToast(msg, type, duration) {
        if (type === undefined) type = "info";
        if (duration === undefined) duration = 3000;
        toastQueue.push({ msg: msg, type: type, duration: duration });
        flushToastQueue();
      }

      function flushToastQueue() {
        while (toastQueue.length > 0 && toastActive < TOAST_MAX_VISIBLE) {
          var item = toastQueue.shift();
          toastActive++;
          var delay = (toastActive - 1) * TOAST_GAP_MS;
          setTimeout(function() {
            _createToast(item.msg, item.type, item.duration);
          }, delay);
        }
      }

      function _createToast(msg, type, duration) {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.innerHTML = `<span>${type === "success" ? "[OK]" : type === "error" ? "[ERR]" : type === "warning" ? "[!]" : "[i]"}</span> ${msg}`;
        container.appendChild(el);
        setTimeout(() => {
          el.style.opacity = "0";
          el.style.transform = "translateX(30px)";
          el.style.transition = ".3s";
          setTimeout(() => {
            if (el.parentNode) el.remove();
            toastActive--;
            flushToastQueue();
          }, 300);
        }, duration);
      }

      // Flush remaining toasts on page unload
      window.addEventListener("beforeunload", function() {
        while (toastQueue.length > 0) {
          var item = toastQueue.shift();
          _createToast(item.msg, item.type, Math.min(item.duration, 1000));
        }
      });
